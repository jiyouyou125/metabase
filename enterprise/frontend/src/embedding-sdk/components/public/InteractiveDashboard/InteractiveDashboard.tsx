import { useCallback, useEffect, useMemo, useState } from "react";
import { usePrevious, useUnmount } from "react-use";

import type { SdkPluginsConfig } from "embedding-sdk";
import { InteractiveAdHocQuestion } from "embedding-sdk/components/private/InteractiveAdHocQuestion";
import { withPublicComponentWrapper } from "embedding-sdk/components/private/PublicComponentWrapper";
import {
  type SdkDashboardDisplayProps,
  useSdkDashboardParams,
} from "embedding-sdk/hooks/private/use-sdk-dashboard-params";
import { useSdkSelector } from "embedding-sdk/store";
import { getPlugins } from "embedding-sdk/store/selectors";
import { NAVIGATE_TO_NEW_CARD, reset } from "metabase/dashboard/actions";
import { getNewCardUrl } from "metabase/dashboard/actions/getNewCardUrl";
import type { NavigateToNewCardFromDashboardOpts } from "metabase/dashboard/components/DashCard/types";
import { useEmbedTheme } from "metabase/dashboard/hooks";
import { useEmbedFont } from "metabase/dashboard/hooks/use-embed-font";
import { useDispatch, useStore } from "metabase/lib/redux";
import * as Urls from "metabase/lib/urls";
import { PublicOrEmbeddedDashboard } from "metabase/public/containers/PublicOrEmbeddedDashboard/PublicOrEmbeddedDashboard";
import { navigateBackToDashboard } from "metabase/query_builder/actions";
import { getMetadata } from "metabase/selectors/metadata";
import { Box } from "metabase/ui";
import type Question from "metabase-lib/v1/Question";
import type { QuestionDashboardCard } from "metabase-types/api";

import { InteractiveDashboardProvider } from "./context";

export type InteractiveDashboardProps = SdkDashboardDisplayProps & {
  questionHeight?: number;
  plugins?: SdkPluginsConfig;
  className?: string;
};

const InteractiveDashboardInner = ({
  dashboardId,
  initialParameterValues = {},
  withTitle = true,
  withCardTitle = true,
  withDownloads = true,
  hiddenParameters = [],
  questionHeight,
  plugins,
  className,
}: InteractiveDashboardProps) => {
  const {
    displayOptions,
    ref,
    isFullscreen,
    onFullscreenChange,
    refreshPeriod,
    onRefreshPeriodChange,
    setRefreshElapsedHook,
  } = useSdkDashboardParams({
    dashboardId,
    withDownloads,
    withTitle,
    hiddenParameters,
    initialParameterValues,
  });
  const dispatch = useDispatch();
  const { theme } = useEmbedTheme();

  const { font } = useEmbedFont();

  const store = useStore();
  const [adhocQuestionUrl, setAdhocQuestionUrl] = useState<string | null>(null);

  const globalPlugins = useSdkSelector(getPlugins);

  const previousDashboardId = usePrevious(dashboardId);

  useUnmount(() => {
    dispatch(reset()); // reset "isNavigatingBackToDashboard" state
  });

  useEffect(() => {
    if (dashboardId !== previousDashboardId) {
      dispatch(reset()); // reset "isNavigatingBackToDashboard" state
      setAdhocQuestionUrl(null);
    }
  }, [dashboardId, dispatch, previousDashboardId]);

  const handleNavigateToNewCardFromDashboard = ({
    nextCard,
    previousCard,
    dashcard,
    objectId,
  }: NavigateToNewCardFromDashboardOpts) => {
    const state = store.getState();
    const metadata = getMetadata(state);
    const { dashboards, parameterValues } = state.dashboard;
    const dashboard = dashboards[dashboardId];

    if (dashboard) {
      const url = getNewCardUrl({
        metadata,
        dashboard,
        parameterValues,
        nextCard,
        previousCard,
        dashcard: dashcard as QuestionDashboardCard,
        objectId,
      });

      if (url) {
        dispatch({ type: NAVIGATE_TO_NEW_CARD, payload: { dashboardId } });

        setAdhocQuestionUrl(url);
      }
    }
  };

  const handleNavigateBackToDashboard = () => {
    dispatch(navigateBackToDashboard(dashboardId)); // set global state for cases when navigate back from question with empty results

    setAdhocQuestionUrl(null);
  };

  const onEditQuestion = useCallback(
    (question: Question) => setAdhocQuestionUrl(Urls.question(question.card())),
    [],
  );

  const providerPlugins = useMemo(() => {
    return { ...globalPlugins, ...plugins };
  }, [globalPlugins, plugins]);

  return (
    <Box w="100%" h="100%" ref={ref} className={className}>
      {adhocQuestionUrl ? (
        <InteractiveAdHocQuestion
          questionPath={adhocQuestionUrl}
          withTitle={withTitle}
          height={questionHeight}
          plugins={providerPlugins}
          onNavigateBack={handleNavigateBackToDashboard}
        />
      ) : (
        <InteractiveDashboardProvider
          plugins={providerPlugins}
          onEditQuestion={onEditQuestion}
        >
          <PublicOrEmbeddedDashboard
            dashboardId={dashboardId}
            parameterQueryParams={initialParameterValues}
            hideDownloadButton={displayOptions.hideDownloadButton}
            hideParameters={displayOptions.hideParameters}
            titled={displayOptions.titled}
            cardTitled={withCardTitle}
            theme={theme}
            isFullscreen={isFullscreen}
            onFullscreenChange={onFullscreenChange}
            refreshPeriod={refreshPeriod}
            onRefreshPeriodChange={onRefreshPeriodChange}
            setRefreshElapsedHook={setRefreshElapsedHook}
            font={font}
            bordered={displayOptions.bordered}
            navigateToNewCardFromDashboard={
              handleNavigateToNewCardFromDashboard
            }
          />
        </InteractiveDashboardProvider>
      )}
    </Box>
  );
};

export const InteractiveDashboard = withPublicComponentWrapper(
  InteractiveDashboardInner,
);
