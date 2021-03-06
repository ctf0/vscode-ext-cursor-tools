'use strict'

const vscode = require('vscode')
const config = vscode.workspace.getConfiguration('cursorTools')
const decor = vscode.window.createTextEditorDecorationType({
    borderStyle : config.border.style,
    borderWidth : config.border.width,
    borderColor : config.border.color || new vscode.ThemeColor('editorCursor.foreground')
})

module.exports = {
    onCommandToggleAnchor,
    onCommandActivateCursors,
    onCommandCleanAnchors,
    onDidChangeTextDocument
}

function onCommandToggleAnchor(textEditor) {
    let {document, selections, cursorAnchors} = textEditor

    for (const selection of selections) {
        const currentDocumentOffset = document.offsetAt(selection.active)
        const index = isAnchorExist(textEditor, currentDocumentOffset)

        index < 0
            ? cursorAnchors.push(currentDocumentOffset)
            : cursorAnchors.splice(index, 1)
    }

    setContext(cursorAnchors.length > 0)
    updateDecorations(textEditor)
}

function onCommandActivateCursors(textEditor, textEditorEdit) {
    let currentDocumentOffset = []

    if (config.includeCurrentCursorOnActivate) {
        currentDocumentOffset = [textEditor.document.offsetAt(textEditor.selection.active)]
    }

    textEditor.selections = currentDocumentOffset
        .concat(textEditor.cursorAnchors)
        .map(createSelection.bind(textEditor))

    onCommandCleanAnchors(textEditor, textEditorEdit)
}

function onCommandCleanAnchors(textEditor) {
    textEditor.cursorAnchors = []

    setContext(false)

    updateDecorations(textEditor)
}

function onDidChangeTextDocument(textDocumentChangeEvent) {
    if (!textDocumentChangeEvent) {
        return
    }

    const textEditor = vscode.window.activeTextEditor

    if (!textEditor) {
        return
    }

    const textDocument = textDocumentChangeEvent.document

    if (textEditor.document !== textDocument) {
        return
    }

    const filters = textDocumentChangeEvent.contentChanges.map((contentChange) => {
        const offsetStart = textDocument.offsetAt(contentChange.range.start)
        const offsetEnd = textDocument.offsetAt(contentChange.range.end)

        return (offset) => !(offset >= offsetStart && offset <= offsetEnd)
    })

    textEditor.cursorAnchors = filters
        .reduce((acc, fn) => acc.filter(fn), textEditor.cursorAnchors)
        .map((offset) => {
            return textDocumentChangeEvent.contentChanges.reduce((acc, contentChange) => {
                if (textDocument.offsetAt(contentChange.range.start) <= offset) {
                    return acc - contentChange.rangeLength + contentChange.text.length
                }

                return acc
            }, offset)
        })

    updateDecorations(textEditor)
}

function updateDecorations(textEditor) {
    const decorRange = textEditor.cursorAnchors
        .map(createRange.bind(textEditor))

    textEditor.setDecorations(decor, decorRange)
}

function isAnchorExist(textEditor, currentDocumentOffset) {
    return textEditor.cursorAnchors.indexOf(currentDocumentOffset)
}

function createSelection(offset) {
    const position = this.document.positionAt(offset)

    return new vscode.Selection(position, position)
}

function createRange(offset) {
    const position = this.document.positionAt(offset)

    return new vscode.Range(position, position)
}

function setContext(value) {
    vscode.commands.executeCommand('setContext', 'cursorToolsAnchors', value)
}
