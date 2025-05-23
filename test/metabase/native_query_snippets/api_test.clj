(ns metabase.native-query-snippets.api-test
  "Tests for /api/native-query-snippet endpoints."
  (:require
   [clojure.string :as str]
   [clojure.test :refer :all]
   [metabase.test :as mt]
   [metabase.util.malli.schema :as ms]
   [toucan2.core :as t2]))

(def ^:private test-snippet-fields [:content :creator_id :description :name])

(defn- snippet-url
  [& [arg & _]]
  (str "native-query-snippet"
       (when arg (str "/" arg))))

(defn- name-schema-error?
  [response]
  (str/starts-with? (or (get-in response [:errors :name]) "")
                    "snippet names cannot include"))

(deftest list-snippets-api-test
  (mt/with-full-data-perms-for-all-users!
    (testing "GET /api/native-query-snippet"
      (mt/with-temp [:model/NativeQuerySnippet snippet-1 {:content "1"
                                                          :name    "snippet_1"}
                     :model/NativeQuerySnippet snippet-2 {:content "2"
                                                          :name    "snippet_2"}]
        (testing "list returns all snippets. Should work for all users"
          (doseq [test-user [:crowberto :rasta]]
            (testing (format "test user = %s" test-user)
              (let [snippets-from-api (->> (mt/user-http-request test-user :get 200 (snippet-url))
                                           (map #(select-keys % test-snippet-fields))
                                           set)]
                (is (contains? snippets-from-api (select-keys snippet-1 test-snippet-fields)))
                (is (contains? snippets-from-api (select-keys snippet-2 test-snippet-fields)))))))))))

(deftest read-snippet-api-test
  (mt/with-full-data-perms-for-all-users!
    (testing "GET /api/native-query-snippet/:id"
      (mt/with-temp [:model/NativeQuerySnippet snippet {:content "-- SQL comment here"
                                                        :name    "comment"}]
        (testing "all users should be able to see all snippets in CE"
          (doseq [test-user [:crowberto :rasta]]
            (testing (format "with test user %s" test-user)
              (let [snippet-from-api (mt/user-http-request test-user :get 200 (snippet-url (:id snippet)))]
                (is (= (select-keys snippet test-snippet-fields)
                       (select-keys snippet-from-api test-snippet-fields)))))))))))

(deftest create-snippet-api-test
  (mt/with-full-data-perms-for-all-users!
    (testing "POST /api/native-query-snippet"
      (testing "new snippet field validation"
        (is (=? {:errors {:content "string"}}
                (mt/user-http-request :rasta :post 400 (snippet-url) {})))

        (is (name-schema-error? (mt/user-http-request :rasta
                                                      :post 400 (snippet-url)
                                                      {:content "NULL"})))

        (is (name-schema-error? (mt/user-http-request :rasta :post 400 (snippet-url)
                                                      {:content "NULL"
                                                       :name    " starts with a space"})))

        (is (name-schema-error? (mt/user-http-request :rasta :post 400 (snippet-url)
                                                      {:content "NULL"
                                                       :name    "contains a } character"}))))))

  (testing "successful create returns new snippet's data"
    (doseq [[message user] {"admin user should be able to create" :crowberto
                            "non-admin user should be able to create" :rasta}]
      (testing message
        (try
          (let [snippet-input    {:name "test-snippet", :description "Just null", :content "NULL"}
                snippet-from-api (mt/user-http-request user :post 200 (snippet-url) snippet-input)]
            (is (malli=
                 [:map
                  [:id          ms/PositiveInt]
                  [:name        [:= "test-snippet"]]
                  [:description [:= "Just null"]]
                  [:content     [:= "NULL"]]
                  [:creator_id  [:= (mt/user->id user)]]
                  [:archived    [:= false]]
                  [:created_at  (ms/InstanceOfClass java.time.OffsetDateTime)]
                  [:updated_at  (ms/InstanceOfClass java.time.OffsetDateTime)]]
                 snippet-from-api)))
          (finally
            (t2/delete! :model/NativeQuerySnippet :name "test-snippet"))))))

  (testing "Attempting to create a Snippet with a name that's already in use should throw an error"
    (try
      (mt/with-temp [:model/NativeQuerySnippet _ {:name "test-snippet-1", :content "1"}]
        (is (= "A snippet with that name already exists. Please pick a different name."
               (mt/user-http-request :crowberto :post 400 (snippet-url) {:name "test-snippet-1", :content "2"})))
        (is (= 1
               (t2/count :model/NativeQuerySnippet :name "test-snippet-1"))))
      (finally
        (t2/delete! :model/NativeQuerySnippet :name "test-snippet-1"))))

  (testing "Shouldn't be able to specify non-default creator_id"
    (try
      (let [snippet (mt/user-http-request :crowberto :post 200 (snippet-url)
                                          {:name "test-snippet", :content "1", :creator_id (mt/user->id :rasta)})]
        (is (= (mt/user->id :crowberto)
               (:creator_id snippet))))
      (finally
        (t2/delete! :model/NativeQuerySnippet :name "test-snippet")))))

(deftest create-snippet-in-collection-test
  (mt/with-full-data-perms-for-all-users!
    (testing "POST /api/native-query-snippet"
      (testing "\nShould be able to create a Snippet in a Collection"
        (letfn [(create! [expected-status-code collection-id]
                  (try
                    (let [response (mt/user-http-request :rasta :post expected-status-code (snippet-url)
                                                         {:name "test-snippet", :description "Just null", :content "NULL", :collection_id collection-id})]
                      {:response response
                       :db       (some->> (:id response) (t2/select-one :model/NativeQuerySnippet :id))})
                    (finally
                      (t2/delete! :model/NativeQuerySnippet :name "test-snippet"))))]
          (mt/with-temp [:model/Collection {collection-id :id} {:namespace "snippets"}]
            (let [{:keys [response db]} (create! 200 collection-id)]
              (testing "\nAPI response"
                (is (= {:name "test-snippet", :collection_id collection-id}
                       (select-keys response [:name :collection_id]))))
              (testing "\nobject in application DB"
                (is (=? {:collection_id collection-id}
                        db)))))

          (testing "\nShould throw an error if the Collection isn't in the 'snippets' namespace"
            (mt/with-temp [:model/Collection {collection-id :id}]
              (is (= {:errors               {:collection_id "A NativeQuerySnippet can only go in Collections in the :snippets namespace."}
                      :allowed-namespaces   ["snippets"]
                      :collection-namespace nil}
                     (:response (create! 400 collection-id))))))

          (testing "\nShould throw an error if Collection does not exist"
            (is (= {:errors {:collection_id "Collection does not exist."}}
                   (:response (create! 404 Integer/MAX_VALUE))))))))))

(deftest update-snippet-api-test
  (mt/with-full-data-perms-for-all-users!
    (testing "PUT /api/native-query-snippet/:id"
      (mt/with-temp [:model/NativeQuerySnippet snippet {:content "-- SQL comment here"
                                                        :name    "comment"}]
        (testing "update stores updated snippet"
          (doseq [[message user] {"admin user should be able to update"     :crowberto
                                  "non-admin user should be able to update" :rasta}]
            (testing message
              (let [updated-desc    "Updated description."
                    updated-snippet (mt/user-http-request user :put 200 (snippet-url (:id snippet))
                                                          {:description updated-desc})]
                (is (= updated-desc (:description updated-snippet)))))))

        (testing "Attempting to change Snippet's name to one that's already in use should throw an error"
          (mt/with-temp [:model/NativeQuerySnippet _         {:name "test-snippet-1" :content "1"}
                         :model/NativeQuerySnippet snippet-2 {:name "test-snippet-2" :content "2"}]
            (is (= "A snippet with that name already exists. Please pick a different name."
                   (mt/user-http-request :crowberto :put 400 (snippet-url (:id snippet-2)) {:name "test-snippet-1"})))
            (is (= 1
                   (t2/count :model/NativeQuerySnippet :name "test-snippet-1")))

            (testing "Passing in the existing name (no change) shouldn't cause an error"
              (is (= {:id (:id snippet-2), :name "test-snippet-2"}
                     (select-keys (mt/user-http-request :crowberto :put 200 (snippet-url (:id snippet-2)) {:name "test-snippet-2"})
                                  [:id :name]))))))

        (testing "Shouldn't be able to change creator_id"
          (mt/with-temp [:model/NativeQuerySnippet snippet {:name "test-snippet", :content "1", :creator_id (mt/user->id :lucky)}]
            (mt/user-http-request :crowberto :put 200 (snippet-url (:id snippet)) {:creator_id (mt/user->id :rasta)})
            (is (= (mt/user->id :lucky)
                   (t2/select-one-fn :creator_id :model/NativeQuerySnippet :id (:id snippet))))))))))

(deftest update-snippet-collection-test
  (mt/with-full-data-perms-for-all-users!
    (testing "PUT /api/native-query-snippet/:id"
      (testing "\nChange collection_id"
        (mt/with-temp [:model/Collection collection-1 {:name "a Collection" :namespace "snippets"}
                       :model/Collection collection-2 {:name "another Collection" :namespace "snippets"}]
          (let [no-collection {:name "no Collection"}]
            (doseq [[source dest] [[no-collection collection-1]
                                   [collection-1 collection-2]
                                   [collection-1 no-collection]]]
              (testing (format "\nShould be able to move a Snippet from %s to %s" (:name source) (:name dest))
                (mt/with-temp [:model/NativeQuerySnippet {snippet-id :id} {:collection_id (:id source)}]
                  (testing "\nresponse"
                    (is (= {:collection_id (:id dest)}
                           (-> (mt/user-http-request :rasta :put 200 (snippet-url snippet-id) {:collection_id (:id dest)})
                               (select-keys [:collection_id :errors])))))
                  (testing "\nvalue in app DB"
                    (is (= (:id dest)
                           (t2/select-one-fn :collection_id :model/NativeQuerySnippet :id snippet-id)))))))))

        (testing "\nShould throw an error if you try to move it to a Collection not in the 'snippets' namespace"
          (mt/with-temp [:model/Collection         {collection-id :id} {}
                         :model/NativeQuerySnippet {snippet-id :id}    {}]
            (is (= {:errors               {:collection_id "A NativeQuerySnippet can only go in Collections in the :snippets namespace."}
                    :allowed-namespaces   ["snippets"]
                    :collection-namespace nil}
                   (mt/user-http-request :rasta :put 400 (snippet-url snippet-id) {:collection_id collection-id})))))

        (testing "\nShould throw an error if Collection does not exist"
          (mt/with-temp [:model/NativeQuerySnippet {snippet-id :id}]
            (is (= {:errors {:collection_id "Collection does not exist."}}
                   (mt/user-http-request :rasta :put 404 (snippet-url snippet-id) {:collection_id Integer/MAX_VALUE})))))))))
