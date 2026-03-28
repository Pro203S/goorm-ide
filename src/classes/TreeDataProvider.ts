import vscode from 'vscode';
import TreeViewItem from './TreeViewItem';

export default class TreeDataProvider implements vscode.TreeDataProvider<TreeViewItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeViewItem | undefined> = new vscode.EventEmitter();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private _items: TreeViewItem[] = [];
    private children: TreeViewItem[] = [];

    getTreeItem(element: TreeViewItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TreeViewItem): Thenable<TreeViewItem[]> {
        if (!element) {
            return Promise.resolve(this._items);
        }
        return Promise.resolve(this.children ?? []);
    }

    addItem(item: TreeViewItem) {
        this._items.push(item);
        this.refresh();
    }

    removeItem(id: string) {
        this._items = this._items.filter(v => v.id !== id);
        this.refresh();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }
}