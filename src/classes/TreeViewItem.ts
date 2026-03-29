import vscode from 'vscode';

export default class TreeViewItem extends vscode.TreeItem {
    public readonly id: string = "";

    constructor(config: {
        "id": string,
        "label"?: string | vscode.TreeItemLabel,
        "description"?: string | boolean,
        "onClick"?: vscode.Command,
        "collapsibleState"?: vscode.TreeItemCollapsibleState,
        "tooltip"?: string | vscode.MarkdownString,
        "icon"?: string | vscode.IconPath,
        "contextValue"?: string
    }) {
        super(config.label ?? "", config.collapsibleState);

        this.id = config.id;

        this.tooltip = config.onClick?.title;
        this.description = config.description;

        this.iconPath = config.icon;

        this.command = undefined;

        this.contextValue = config.contextValue;

        if (config.onClick)
            this.command = config.onClick;
    }
}