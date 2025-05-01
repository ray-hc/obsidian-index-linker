import {
	App,
	Plugin,
	PluginSettingTab,
	Setting,
	TFolder,
	TFile,
	Notice,
	SuggestModal,
	Editor,
	MarkdownView,
  MarkdownFileInfo,
} from "obsidian";

interface IndexLinkerSettings {
	defaultIndexName: string;
	linkTextPattern: string; // e.g., "Index for {folder}"
}

const DEFAULT_SETTINGS: IndexLinkerSettings = {
	defaultIndexName: "index",
	linkTextPattern: "{folder}/index",
};

export default class IndexLinkerPlugin extends Plugin {
	settings: IndexLinkerSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: "insert-folder-index-link",
			name: "Insert link to folder index file",
			editorCallback: (editor, view) => this.openFolderSuggestModal(editor, view),
		});

		this.addSettingTab(new IndexLinkerSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	openFolderSuggestModal(editor: Editor, view: MarkdownView | MarkdownFileInfo) {
		const folders = this.app.vault.getAllFolders();

		new FolderSuggestModal(this.app, folders, async (folder) => {
			const folderName = folder.name;
			const indexPath = `${folder.path}/${this.settings.defaultIndexName}.md`;
			let file = this.app.vault.getAbstractFileByPath(indexPath);

			if (!file) {
				file = await this.app.vault.create(indexPath, `# ${this.settings.defaultIndexName}`);
				new Notice(`Created file: ${indexPath}`);
			}

			if (!(file instanceof TFile)) {
				new Notice(`Error: Could not create or find the index file.`);
				return;
			}

			const alias = this.settings.linkTextPattern.replace("{folder}", folderName);
			const markdownLink = this.app.fileManager.generateMarkdownLink(file, view?.file?.path || "", undefined, alias);
			editor.replaceSelection(markdownLink);
		}).open();
	}
}

class FolderSuggestModal extends SuggestModal<TFolder> {
	folders: TFolder[];
	onChoose: (folder: TFolder) => void;

	constructor(app: App, folders: TFolder[], onChoose: (folder: TFolder) => void) {
		super(app);
		this.folders = folders;
		this.onChoose = onChoose;
		this.setPlaceholder("Choose a folder to link its index...");
	}

	getSuggestions(query: string): TFolder[] {
		return this.folders.filter((folder) =>
			folder.path.toLowerCase().contains(query.toLowerCase())
		);
	}

	renderSuggestion(folder: TFolder, el: HTMLElement) {
		el.setText(folder.path);
	}

	onChooseSuggestion(folder: TFolder) {
		this.onChoose(folder);
	}
}

class IndexLinkerSettingTab extends PluginSettingTab {
	plugin: IndexLinkerPlugin;

	constructor(app: App, plugin: IndexLinkerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Index Linker Settings" });

		new Setting(containerEl)
			.setName("Default Index File Name")
			.setDesc("The name of the index file to link or create in selected folders (no extension).")
			.addText((text) =>
				text
					.setPlaceholder("index")
					.setValue(this.plugin.settings.defaultIndexName)
					.onChange(async (value) => {
						this.plugin.settings.defaultIndexName = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Link Display Text Pattern")
			.setDesc("Use {folder} to include the folder name in the link alias.")
			.addText((text) =>
				text
					.setPlaceholder("{folder}/index")
					.setValue(this.plugin.settings.linkTextPattern)
					.onChange(async (value) => {
						this.plugin.settings.linkTextPattern = value.trim();
						await this.plugin.saveSettings();
					})
			);
	}
}

