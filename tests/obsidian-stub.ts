// Minimal stand-in for the `obsidian` package (which only ships type definitions) so that modules which import
// runtime values from it can be unit tested. Tests extend these classes with the behavior they need.
export class MarkdownView {}
