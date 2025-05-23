import { match } from "ts-pattern";

import { PLUGIN_AI_ENTITY_ANALYSIS } from "metabase/plugins";
import DataReference from "metabase/query_builder/components/dataref/DataReference";
import { SnippetSidebar } from "metabase/query_builder/components/template_tags/SnippetSidebar";
import { TagEditorSidebar } from "metabase/query_builder/components/template_tags/TagEditorSidebar";
import { QuestionInfoSidebar } from "metabase/query_builder/components/view/sidebars/QuestionInfoSidebar";
import { QuestionSettingsSidebar } from "metabase/query_builder/components/view/sidebars/QuestionSettingsSidebar";
import TimelineSidebar from "metabase/query_builder/components/view/sidebars/TimelineSidebar";

export const NativeQueryRightSidebar = (props) => {
  const {
    question,
    timelines,
    toggleTemplateTagsEditor,
    toggleDataReference,
    toggleSnippetSidebar,
    showTimelineEvent,
    showTimelineEvents,
    hideTimelineEvents,
    selectTimelineEvents,
    deselectTimelineEvents,
    onCloseTimelines,
    onSave,
    onCloseQuestionInfo,
    isShowingTemplateTagsEditor,
    isShowingDataReference,
    isShowingSnippetSidebar,
    isShowingTimelineSidebar,
    isShowingQuestionInfoSidebar,
    isShowingQuestionSettingsSidebar,
    isShowingAIQuestionAnalysisSidebar,
    onCloseAIQuestionAnalysisSidebar,
  } = props;

  return match({
    isShowingTemplateTagsEditor,
    isShowingDataReference,
    isShowingSnippetSidebar,
    isShowingTimelineSidebar,
    isShowingQuestionInfoSidebar,
    isShowingQuestionSettingsSidebar,
    isShowingAIQuestionAnalysisSidebar,
  })
    .with({ isShowingTemplateTagsEditor: true }, () => (
      <TagEditorSidebar
        {...props}
        query={question.legacyNativeQuery()}
        onClose={toggleTemplateTagsEditor}
      />
    ))
    .with({ isShowingDataReference: true }, () => (
      <DataReference {...props} onClose={toggleDataReference} />
    ))
    .with({ isShowingSnippetSidebar: true }, () => (
      <SnippetSidebar {...props} onClose={toggleSnippetSidebar} />
    ))
    .with({ isShowingTimelineSidebar: true }, () => (
      <TimelineSidebar
        {...props}
        onShowTimelineEvent={showTimelineEvent}
        onShowTimelineEvents={showTimelineEvents}
        onHideTimelineEvents={hideTimelineEvents}
        onSelectTimelineEvents={selectTimelineEvents}
        onDeselectTimelineEvents={deselectTimelineEvents}
        onClose={onCloseTimelines}
      />
    ))
    .with({ isShowingQuestionInfoSidebar: true }, () => (
      <QuestionInfoSidebar
        question={question}
        onSave={onSave}
        onClose={onCloseQuestionInfo}
      />
    ))
    .with({ isShowingQuestionSettingsSidebar: true }, () => (
      <QuestionSettingsSidebar question={question} />
    ))
    .with({ isShowingAIQuestionAnalysisSidebar: true }, () => (
      <PLUGIN_AI_ENTITY_ANALYSIS.AIQuestionAnalysisSidebar
        question={question}
        timelines={timelines}
        onClose={onCloseAIQuestionAnalysisSidebar}
      />
    ))
    .otherwise(() => null);
};
