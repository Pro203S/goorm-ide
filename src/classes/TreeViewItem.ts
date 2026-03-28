import vscode from 'vscode';

export default class TreeViewItem extends vscode.TreeItem {
    public readonly id: string = "";

    constructor(config: {
        "id": string,
        "label": string,
        "description"?: string,
        "onClick"?: vscode.Command,
        "collapsibleState": vscode.TreeItemCollapsibleState,
        "tooltip"?: string,
        "icon"?: string | vscode.IconPath,
        "contextValue"?: string
    }) {
        super(config.label, config.collapsibleState);

        this.id = config.id;

        this.tooltip = config.label;
        this.description = config.description;

        this.iconPath = config.icon;

        this.command = undefined;

        this.contextValue = config.contextValue;

        if (config.onClick)
            this.command = config.onClick;
    }
}