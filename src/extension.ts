
import * as vscode from 'vscode';

import * as net from 'net';

const isDebugMode = () => process.env.VSCODE_DEBUG_MODE === "true";

import * as _bonjour from "bonjour";
const bonjour = _bonjour();

let isConnected = false;
const PORT = 1527;
const client = new net.Socket();
const appOut = vscode.window.createOutputChannel("Vassist Output");

const traversingViewScript = "requireAccessibility()\ntraversing(rootView())\n" + "print(runtime.currentApp)";

let lastIp = "";
let lastCmd = "";

function resetBonjour() {
	return bonjour.find({ type: "vassistant-rds" }, (service) => {
		console.log("service up: ", service);
		reqConnect(service);
	});
}

let browser = resetBonjour();


client.on("data", function (data) {//app消息
	appOut.show(true);
	appOut.append(data.toString());
});
client.on("close", function (hadError) {
	if (isConnected) {
		appOut.show(true);
		appOut.appendLine("断开连接 ");
	}
	else if (hadError) {
		appOut.show(true);
		appOut.appendLine("连接失败，请确保ip正确");
	}
	isConnected = false;
	browser = resetBonjour();
});

export function activate(context: vscode.ExtensionContext) {
	console.log('"vassist-debugger" is now active!');

	//连接手机
	const commandConnect = vscode.commands.registerCommand('extension.connect', () => {
		vscode.window.showInputBox({
			placeHolder: "输入手机ip（同一局域网）/ 或者直接回车自动连接",
			value: lastIp
		}).then((s) => {
			console.log(s);
			lastIp = s || "";
			connect(s);
		});
	});
	const closeConnect = vscode.commands.registerCommand('extension.closeConnect', () => {
		if (isConnected)
			client.destroy();
		else
			showInfo("未连接");
	});

	//测试运行
	const testRun = vscode.commands.registerCommand('extension.testRun', () => {
		if (!isConnected) {
			showInfo("请先连接手机");
			return;
		}
		const s = getSeletedText();
		if (s == null) showInfo("未选择文件");
		else
			send(wrapAction("run", getType(), s));
	});

	const stopRun = vscode.commands.registerCommand('extension.stopRun', () => {
		if (!isConnected) {
			showInfo("请先连接手机");
			return;
		}
		send(wrapAction("stop", "", ""));
	});

	const traversingView = vscode.commands.registerCommand('extension.traversingView', () => {
		if (!isConnected) {
			showInfo("请先连接手机");
			return;
		}
		send(wrapAction("run", 'lua', traversingViewScript));
	});
	const uploadInstAsGlobal = vscode.commands.registerCommand('extension.uploadInstAsGlobal', () => {
		if (!isConnected) {
			showInfo("请先连接手机");
			return;
		}
		const s = getSeletedText();
		if (s == null) showInfo("未选择文件");
		else
			send(wrapAction("new_inst_as_global", getType(), s));
	});
	const uploadInstAsInApp = vscode.commands.registerCommand('extension.uploadInstAsInApp', () => {
		if (!isConnected) {
			showInfo("请先连接手机");
			return;
		}
		const s = getSeletedText();
		if (s == null) showInfo("未选择文件");
		else
			send(wrapAction("new_inst_as_inapp", getType(), s));
	});
	const copyToClip = vscode.commands.registerCommand('extension.copyToClip', () => {
		if (!isConnected) {
			showInfo("请先连接手机");
			return;
		}
		const s = getSeletedText();
		if (s == null) showInfo("未选择文件");
		else
			send(wrapAction("copyText", "", s));
	});
	const runCommand = vscode.commands.registerCommand('extension.runCommand', () => {
		if (!isConnected) {
			showInfo("请先连接手机");
			return;
		}
		vscode.window.showInputBox({
			placeHolder: "执行命令",
			value: lastCmd
		}).then(function (s) {
			console.log(s);
			lastCmd = s || "";
			send(wrapAction("command", "", s || ""));
		});
	});
	if (isDebugMode()) {
		vscode.commands.registerCommand("extension.testSelText", () => {
			console.log(getSeletedText());
			console.log(getType());
		});
	}

	createStatusBarIcons();

	context.subscriptions.push(commandConnect);
	context.subscriptions.push(closeConnect);
	context.subscriptions.push(testRun);
	context.subscriptions.push(stopRun);
	context.subscriptions.push(traversingView);
	context.subscriptions.push(runCommand);
	context.subscriptions.push(uploadInstAsGlobal);
	context.subscriptions.push(uploadInstAsInApp);
	context.subscriptions.push(copyToClip);

	// const vc = buildVAssistScriptCompletion();
	// const vc2 = buildVAssistSubFunCompletion();
	// vscode.languages.registerCompletionItemProvider("lua", vc);
	// vscode.languages.registerCompletionItemProvider("lua", vc2);
	// vscode.languages.registerCompletionItemProvider("javascript", vc);
	// vscode.languages.registerCompletionItemProvider("javascript", vc2);
}
export function deactivate() {
	if (isConnected)
		client.destroy();
	console.log("deactivate vassist");
}

function reqConnect(service: _bonjour.RemoteService) {
	const ip = service.addresses[0];
	const port = service.port;
	const name = service.name;

	vscode.window.showInformationMessage("发现设备：" + name + " [" + ip + "]", "连接", "取消").then((i) => {
		if (i == "连接") {
			connect(ip, port);
		}
	});
}
//连接
function connect(ip: string | undefined, port: number = PORT) {
	if (!ip) {
		browser.stop();
		browser = resetBonjour();
		return;
	}
	client.destroy();
	client.connect(port, ip, function () {
		isConnected = true;
		browser.stop();
		vscode.window.showInformationMessage("建立连接：" + client.remoteAddress);
	});
	console.log("连接手机：" + ip);
}
function getEditor() {
	let actEdt = vscode.window.activeTextEditor;
	if (actEdt?.document?.languageId == "code-runner-output") {
		actEdt = vscode.window.visibleTextEditors[0];
	}
	return actEdt;
}
//文件类型
function getType() {
	const lang = getEditor()?.document?.languageId;
	return lang || "";
}

//封装
/**
 * 
 * @param {*} action 空-> 获取编辑器内容 非空指定文本
 * @param {*} script 
 */
function wrapAction(action: string, type: string, script: string) {
	if (action === "run" && type == "") {
		showInfo("不支持的文件类型 " + type);
		return "";
	}

	return JSON.stringify({
		action: action,//动作
		type: type,//脚本类型
		text: script//内容
	});
}
//发送socket
function send(json: string) {
	if (!json) {
		return;
	}
	console.log(json);
	client.write(json + "\n", "utf8");
}

function showInfo(s: string) {
	console.log(s);
	vscode.window.showInformationMessage(s);
}
//获取编辑框选择文本
function getSeletedText() {
	try {
		const actEditor = getEditor();
		if(!actEditor) {
			console.error("no editor");
			return "";
		}
		const doc = actEditor.document;
		const sels = actEditor.selections;
		if (!doc || !sels) {
			console.log("doc or sel is null");
			return "";
		}
		let script = "";
		const noSel = sels.length === 1 && sels[0].start.line === sels[0].end.line
			&& sels[0].start.character === sels[0].end.character;
		if (noSel) {//未选择
			script = doc.getText();
		} else { //build script
			let lastLine = sels[0].end.line;
			sels.forEach(sel => {
				const statLine = sel.start.line;
				const endLine = sel.end.line;
				if (lastLine != endLine) {
					script += "\n";
				}
				script += doc.lineAt(statLine).text.substring(sel.start.character, statLine == endLine ?
					sel.end.character : doc.lineAt(statLine).text.length);
				if (endLine > statLine) {
					script += "\n";
				}
				for (let l = statLine + 1; l < endLine; l++) {
					script += doc.lineAt(l).text + "\n";
				}
				if (statLine != endLine)
					script += doc.lineAt(endLine).text.substring(0, sel.end.character);


				lastLine = endLine;
			});
		}
		return script;
	} catch (e) {
		return null;
	}
}

function createStatusBarIcons() {
	//状态栏-连接
	showButton(46, 'extension.connect', `$(zap)`, "连接手机", "yellow");

	//状态栏-断开连接
	showButton(45, 'extension.closeConnect', `$(x)`, "断开连接", "red");
	//状态栏-运行
	showButton(44, 'extension.testRun', `$(triangle-right)`, "运行", "yellow");

	//状态栏-停止
	showButton(40, 'extension.stopRun', `$(primitive-square)`, "停止", "red");

	//状态栏-命令
	showButton(39, 'extension.runCommand', `$(terminal)`, "运行指令", null);
	//状态栏-打印屏幕
	showButton(38, 'extension.traversingView', `$(device-camera)`, "输出布局", null);
	//上传代码到新建指令页面
	showButton(37, 'extension.uploadInstAsGlobal', `$(arrow-up)`, "新建全局指令", "light-green");
	showButton(36, 'extension.uploadInstAsInApp', `$(arrow-up)`, "新建App内指令", "yellow");
	showButton(35, 'extension.copyToClip', `$(clippy)`, "复制到手机剪切板", null);

	if (isDebugMode()) {
		showButton(34, 'extension.testSelText', `$(find-selection)`, "测试选择文本", null);
	}
}

function showButton(p: number, commmand: string, text: string, tooltip: string, color: string | null) {
	const button = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, p);
	button.command = commmand;
	button.text = text;
	button.tooltip = tooltip;
	if (color)
		button.color = color;
	button.show();
}