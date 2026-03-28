import vscode from 'vscode';

export default class TreeViewItem extends vscode.TreeItem {
    public readonly id: string = "";

    constructor(config: {
        "id": string,
        "label": string,
        "description"?: string,
        "onClick": string,
        "collapsibleState": vscode.TreeItemCollapsibleState,
        "tooltip"?: string
    }) {
        super(config.label, config.collapsibleState);

        this.id = config.id;

        this.tooltip = config.label;
        this.description = config.description;

        this.command = {
            "command": config.onClick,
            "title": 'Item Click',
            "tooltip": config.tooltip,
            "arguments": [config.id]
        };
    }
}