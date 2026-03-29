import vscode from 'vscode';
import TreeViewItem from './TreeViewItem';

export default class TreeDataProvider implements vscode.TreeDataProvider<TreeViewItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeViewItem | undefined> = new vscode.EventEmitter();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private _items: TreeViewItem[] = [];
    private _children: Record<string, TreeViewItem[]> = {};

    getTreeItem(element: TreeViewItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TreeViewItem): Thenable<TreeViewItem[]> {
        if (!element) {
            return Promise.resolve(this._items);
        }
        return Promise.resolve(this._children[element.id] ?? []);
    }

    addItem(item: TreeViewItem) {
        this._items.push(item);
        this.refresh();
    }

    addChildren(id: string, item: TreeViewItem) {
        if (!this._children[id])
            this._children[id] = [];

        this._children[id].push(item);
        this.refresh();
    }

    removeChildren(id: string, itemId: string) {
        if (!this._children[id])
            this._children[id] = [];

        this._children[id] = this._children[id].filter(v => v.id !== itemId);
        this.refresh();
    }

    removeItem(id: string) {
        this._items = this._items.filter(v => v.id !== id);
        this.refresh();
    }

    changeChildren(parentId: string, index: number, item: TreeViewItem) {
        const parent = this._children[parentId];
        if (!parent) throw new Error("Parent not found");

        parent[index] = item;
        this.refresh();
    }

    changeItem(index: number, item: TreeViewItem) {
        this._items[index] = item;
        this.refresh();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }
}