import * as vscode from 'vscode';

// todo
export function buildVAssistScriptCompletion() {
	return {
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) {
			console.log(context.triggerKind.toString() + "  " + context.triggerCharacter);
			return [
				new vscode.CompletionItem('app'),
				new vscode.CompletionItem('runtime'),
				new vscode.CompletionItem('utils'),
				new vscode.CompletionItem('system'),
				new vscode.CompletionItem('input'),
				new vscode.CompletionItem('http'),
				new vscode.CompletionItem('shell'),
			];
		}
	};
}
export function buildVAssistSubFunCompletion() {
	return {
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) {
			console.log(context.triggerKind.toString() + "  " + context.triggerCharacter);
			const simpleCompletion = new vscode.CompletionItem('Hello World!');
			return [simpleCompletion];
		}
	};
}