export type HeadingMindmapStrings = {
  commands: {
    open: string;
    toggleListItemExpansion: string;
  };
  ribbon: {
    open: string;
  };
};

const STRINGS: HeadingMindmapStrings = {
  commands: {
    open: "Open mind map",
    toggleListItemExpansion: "Toggle body list items in mind map"
  },
  ribbon: {
    open: "Open mind map"
  }
};

export function getHeadingMindmapStrings(): HeadingMindmapStrings {
  return STRINGS;
}
