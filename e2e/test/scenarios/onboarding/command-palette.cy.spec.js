import { USERS } from "e2e/support/cypress_data";
import {
  ORDERS_COUNT_QUESTION_ID,
  ORDERS_DASHBOARD_ID,
} from "e2e/support/cypress_sample_instance_data";
import {
  closeCommandPalette,
  commandPalette,
  commandPaletteButton,
  commandPaletteInput,
  openCommandPalette,
  pressEnd,
  pressHome,
  pressPageDown,
  pressPageUp,
  restore,
  visitFullAppEmbeddingUrl,
} from "e2e/support/helpers";

const { admin } = USERS;

describe("command palette", () => {
  beforeEach(() => {
    restore();
    cy.signInAsAdmin();
  });

  it("should render a searchable command palette", () => {
    // //Add a description for a check
    cy.request("PUT", `/api/card/${ORDERS_COUNT_QUESTION_ID}`, {
      description: "The best question",
    });

    //Request to have an item in the recents list
    cy.request(`/api/dashboard/${ORDERS_DASHBOARD_ID}`);
    cy.visit("/");

    cy.findByRole("button", { name: /Search/ }).click();
    closeCommandPalette();

    cy.log("open the command palette with keybinding");
    openCommandPalette();
    commandPalette().within(() => {
      commandPaletteInput().should("exist");

      cy.log("limit to 5 basic actions");
      cy.findByText("New question");
      cy.findByText("New SQL query");
      cy.findByText("New dashboard");
      cy.findByText("New collection");
      cy.findByText("New model");
      cy.findByText("New metric").should("not.exist");

      cy.log("Should show recent items");
      cy.findByRole("option", { name: "Orders in a dashboard" }).should(
        "contain.text",
        "Our analytics",
      );

      cy.log("Should search entities and docs");
      commandPaletteInput().type("Orders, Count");

      cy.findByRole("option", { name: "Orders, Count" })
        .should("contain.text", "Our analytics")
        .should("contain.text", "The best question");

      cy.findByText('Search documentation for "Orders, Count"').should("exist");

      // Since the command palette list is virtualized, we will search for a few
      // to ensure they're reachable
      commandPaletteInput().clear().type("People");
      cy.findByRole("option", { name: "People" }).should("exist");

      commandPaletteInput().clear().type("Uploads");
      cy.findByRole("option", { name: "Settings - Uploads" }).should("exist");

      // When entering a query, if there are results that come before search results, highlight
      // the first action, otherwise, highlight the first search result
      commandPaletteInput().clear().type("For");
      cy.findByRole("option", { name: "Performance" }).should(
        "have.attr",
        "aria-selected",
        "true",
      );
      cy.findByRole("option", { name: /View and filter/ }).should("exist");

      // Check that we are not filtering search results by action name
      commandPaletteInput().clear().type("Company");
      cy.findByRole("option", { name: /View and filter/ }).should("exist");
      cy.findByRole("option", { name: "REVIEWS" }).should(
        "have.attr",
        "aria-selected",
        "true",
      );
      cy.findByRole("option", { name: "PEOPLE" }).should("exist");
      cy.findByRole("option", { name: "PRODUCTS" }).should("exist");
      commandPaletteInput().clear();

      commandPaletteInput().clear().type("New met");
      cy.findByText("New metric").should("exist");
    });

    cy.log("We can close the command palette using escape");
    closeCommandPalette();
    commandPalette().should("not.exist");

    openCommandPalette();

    commandPalette()
      .findByRole("option", { name: "Orders in a dashboard" })
      .should("have.attr", "aria-selected", "true");

    pressPageDown();

    commandPalette()
      .findByRole("option", { name: "New dashboard" })
      .should("have.attr", "aria-selected", "true");

    pressPageDown();

    commandPalette()
      .findByRole("option", { name: "New model" })
      .should("have.attr", "aria-selected", "true");

    pressPageUp();
    commandPalette()
      .findByRole("option", { name: "New question" })
      .should("have.attr", "aria-selected", "true");

    pressEnd();

    commandPalette()
      .findByRole("option", { name: "New model" })
      .should("have.attr", "aria-selected", "true");

    pressHome();
    commandPalette()
      .findByRole("option", { name: "Orders in a dashboard" })
      .should("have.attr", "aria-selected", "true");
  });

  it("should display search results in the order returned by the API", () => {
    cy.visit("/");

    cy.findByRole("button", { name: /Search/ }).click();
    cy.intercept("/api/search?*").as("searchData");

    commandPalette().within(() => {
      commandPaletteInput().type("Cou");
      cy.wait("@searchData");
      cy.findByText("Loading...").should("not.exist");

      cy.get("@searchData").then(({ response }) => {
        const results = response.body.data;

        results.forEach((result, index) => {
          cy.findAllByRole("option")
            .eq(index + 2)
            .should("contain.text", result.name);
        });
      });
    });
  });

  it("should render links to site settings in settings pages", () => {
    cy.visit("/admin");
    cy.findByRole("heading", { name: "Getting set up" }).should("exist");
    openCommandPalette();

    commandPalette().within(() => {
      commandPaletteInput().type("Custom Homepage");
      cy.findByRole("option", { name: "Custom Homepage" }).click();
    });

    cy.findByTestId("custom-homepage-setting").should("be.visible");

    cy.location("pathname").should("contain", "settings/general");
    cy.location("hash").should("contain", "#custom-homepage");

    openCommandPalette();

    commandPalette().within(() => {
      commandPaletteInput().clear().type("Week");
      cy.findByRole("option", { name: "First day of the week" }).click();
    });

    cy.location("pathname").should("contain", "settings/localization");
    cy.location("hash").should("contain", "#start-of-week");
  });

  it("should not be accessible when doing full app embedding", () => {
    visitFullAppEmbeddingUrl({
      url: "/",
      qs: {
        top_nav: true,
        search: true,
      },
    });

    cy.findByPlaceholderText("Search…").click();
    cy.findByRole("button", { name: / \+ K/ }).should("not.exist");

    cy.get("body").type("{esc}");

    openCommandPalette();
    commandPalette().should("not.exist");
  });

  it("should not be accessible when a user is not logged in", () => {
    cy.intercept("GET", "/api/search**").as("search");
    cy.intercept("GET", "/api/database").as("database");

    cy.signOut();
    cy.visit("/");

    cy.findByRole("heading", { name: "Sign in to Metabase" });

    openCommandPalette();
    commandPalette().should("not.exist");

    cy.get("@database").should("be.null");
    cy.get("@search").should("be.null");

    cy.findByLabelText(/Email address/).type(admin.email);
    cy.findByLabelText("Password").type(admin.password);
    cy.button("Sign in").click();
    cy.findByTestId("greeting-message");

    openCommandPalette();
    commandPalette().should("exist");
  });

  it("The Search button should resize when on mobile", () => {
    cy.viewport("iphone-x");
    cy.visit("/");
    commandPaletteButton().should("not.contain.text", "search");
  });

  it("Should have a new metric item", () => {
    cy.visit("/");
    cy.findByRole("button", { name: /Search/ }).click();

    commandPalette().within(() => {
      commandPaletteInput().should("exist").type("Me");
      cy.findByText("New metric").should("be.visible").click();

      cy.location("pathname").should("eq", "/metric/query");
    });
  });
});
