import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface swiftStormPluginSettings {
	username: string;
	webhookUrl: string;
	autoSync: boolean;
	syncOnChange: boolean;
	conflictResolution: 'size' | 'date';
	lastSyncTime: number;
	telegramUsername: string;
	confirmationToken: string;
	isRegistered: boolean;
}

const DEFAULT_SETTINGS: swiftStormPluginSettings = {
	username: '',
	webhookUrl: 'http://212.67.13.115:3005',
	autoSync: false,
	syncOnChange: true,
	conflictResolution: 'date',
	lastSyncTime: 0,
	telegramUsername: '',
	confirmationToken: '',
	isRegistered: false
}

export default class swiftStormRemoteVaultPlugin extends Plugin {
	settings: swiftStormPluginSettings;
	private isConnected: boolean = false;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'swiftStorm Remote Vault', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('swiftStorm Remote Vault подключен!');
		});

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'sync-swiftstorm-vault',
			name: 'Синхронизировать хранилище swiftStorm',
			callback: () => {
				this.syncVault();
			}
		});

		// This adds a command for opening settings
		this.addCommand({
			id: 'open-swiftstorm-settings',
			name: 'Открыть настройки swiftStorm',
			callback: () => {
				this.app.setting.open();
				this.app.setting.openTabById(this.manifest.id);
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new swiftStormSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));

		// Автосинхронизация при запуске
		if (this.settings.autoSync && this.settings.isRegistered) {
			setTimeout(() => {
				this.syncVault();
			}, 2000); // Задержка 2 секунды для полной загрузки Obsidian
		}

		// Регулярная синхронизация каждые 5 минут
		if (this.settings.isRegistered) {
			this.registerInterval(window.setInterval(() => {
				if (this.settings.syncOnChange) {
					this.syncVault();
				}
			}, 5 * 60 * 1000)); // 5 минут
		}

		// Обработчики событий файловой системы для двусторонней синхронизации
		if (this.settings.isRegistered && this.settings.syncOnChange) {
			this.registerEvent(this.app.vault.on('create', (file) => {
				this.uploadFileToServer(file);
			}));

			this.registerEvent(this.app.vault.on('modify', (file) => {
				this.uploadFileToServer(file);
			}));

			this.registerEvent(this.app.vault.on('delete', (file) => {
				this.deleteFileFromServer(file);
			}));

			this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
				this.renameFileOnServer(file, oldPath);
			}));
		}

		console.log('swiftStorm Remote Vault plugin загружен');
	}

	onunload() {
		this.disconnect();
		console.log('swiftStorm Remote Vault plugin выгружен');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async registerViaTelegram() {
		if (!this.settings.telegramUsername) {
			new Notice('❌ Укажите Telegram username в настройках');
			return;
		}

		try {
			new Notice('🔄 Отправка запроса подтверждения в Telegram...');
			
			// Отправляем запрос на регистрацию
			const response = await fetch(`${this.settings.webhookUrl}/obsidian-sync`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					telegramUsername: this.settings.telegramUsername
				})
			});

			if (response.ok) {
				const data = await response.json();
				
				if (data.status === 'confirmation_sent') {
					this.settings.confirmationToken = data.token;
					await this.saveSettings();
					
					new Notice('✅ Запрос отправлен! Проверьте Telegram и нажмите "Это я"');
					
					// Начинаем опрос статуса подтверждения
					this.pollConfirmationStatus();
				} else {
					new Notice(`❌ Ошибка регистрации: ${data.error || 'Неизвестная ошибка'}`);
				}
			} else {
				const errorData = await response.json();
				new Notice(`❌ Ошибка сервера: ${errorData.error || 'Неизвестная ошибка'}`);
			}
		} catch (error) {
			console.error('Ошибка регистрации:', error);
			new Notice(`❌ Ошибка сети: ${error.message}`);
		}
	}

	async pollConfirmationStatus() {
		if (!this.settings.confirmationToken) return;

		const maxAttempts = 30; // 5 минут максимум
		let attempts = 0;

		const poll = async () => {
			attempts++;
			
			try {
				const response = await fetch(`${this.settings.webhookUrl}/get-credentials`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						token: this.settings.confirmationToken
					})
				});

				if (response.ok) {
					const data = await response.json();
					
					if (data.status === 'confirmed') {
						// Сохраняем данные пользователя
						// Username получаем из ответа
						if (data.username) {
							this.settings.username = data.username;
						}
						this.settings.isRegistered = true;
						this.settings.confirmationToken = '';
						await this.saveSettings();
						
						new Notice('✅ Подтверждение получено! Данные сохранены.');
						
						// Автоматически синхронизируем
						await this.syncVault();
						return;
					} else if (data.status === 'rejected') {
						new Notice('❌ Подтверждение отклонено');
						this.settings.confirmationToken = '';
						await this.saveSettings();
						return;
					}
				}
				
				// Продолжаем опрос если не достигли лимита
				if (attempts < maxAttempts) {
					setTimeout(poll, 10000); // 10 секунд
				} else {
					new Notice('⏰ Время ожидания истекло');
					this.settings.confirmationToken = '';
					await this.saveSettings();
				}
			} catch (error) {
				console.error('Ошибка опроса статуса:', error);
				if (attempts < maxAttempts) {
					setTimeout(poll, 10000);
				}
			}
		};

		poll();
	}

	async syncVault() {
		if (!this.settings.username) {
			new Notice('❌ Сначала зарегистрируйтесь через Telegram');
			return;
		}

		try {
			new Notice('🔄 Синхронизация с swiftStorm хранилищем...');
			
			// Отправляем запрос на синхронизацию
			const response = await fetch(`${this.settings.webhookUrl}/sync-vault`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					username: this.settings.username
				})
			});

			if (response.ok) {
				const data = await response.json();
				
				if (data.status === 'success') {
					// Создаем папки из данных сервера прямо в корне хранилища
					if (data.vault.folders) {
						for (const folder of data.vault.folders) {
							await this.app.vault.createFolder(folder).catch(() => {});
						}
					}
					
					// Создаем файлы из данных сервера прямо в корне хранилища
					if (data.vault.files) {
						for (const file of data.vault.files) {
							const filePath = file.name; // Используем путь как есть
							const content = file.content || `# ${file.name}\n\nФайл синхронизирован с swiftStorm хранилища.`;
							
							try {
								await this.app.vault.create(filePath, content);
							} catch (error) {
								// Если файл уже существует, обновляем его
								const existingFile = this.app.vault.getAbstractFileByPath(filePath);
								if (existingFile) {
									await this.app.vault.modify(existingFile as any, content);
								}
							}
						}
					}
					
					// Обновляем время последней синхронизации
					this.settings.lastSyncTime = Date.now();
					await this.saveSettings();
					
					this.isConnected = true;
					new Notice(`✅ Синхронизация успешна! Получено ${data.vault.files?.length || 0} файлов`);
					
					// Создаем файл статуса в корне
					const statusFile = `📋 Статус синхронизации swiftStorm.md`;
					const statusContent = `# 🔗 swiftStorm Remote Vault

## 📊 Информация о синхронизации

**Пользователь:** ${data.username}  
**Статус:** ✅ Синхронизировано  
**Время синхронизации:** ${new Date().toLocaleString()}  
**Файлов получено:** ${data.vault.files?.length || 0}  
**Папок создано:** ${data.vault.folders?.length || 0}

## 📁 Структура папок

${data.vault.folders?.map(folder => `- **📁 ${folder}/**`).join('\n') || 'Папки не найдены'}

## 🚀 Возможности

- Синхронизация файлов с сервера
- Автоматическое обновление при изменениях
- Организация документов по папкам
- Резервное копирование в облаке

---
*Создано плагином swiftStorm Remote Vault v2.0*
`;

					try {
						await this.app.vault.create(statusFile, statusContent);
					} catch (error) {
						const existingFile = this.app.vault.getAbstractFileByPath(statusFile);
						if (existingFile) {
							await this.app.vault.modify(existingFile as any, statusContent);
						}
					}
					
				} else {
					new Notice(`❌ Ошибка синхронизации: ${data.error || 'Неизвестная ошибка'}`);
				}
			} else {
				const errorData = await response.json();
				new Notice(`❌ Ошибка сервера: ${errorData.error || 'Неизвестная ошибка'}`);
			}
		} catch (error) {
			console.error('Ошибка синхронизации:', error);
			new Notice(`❌ Ошибка сети: ${error.message}`);
		}
	}

	isConnectedToVault(): boolean {
		return this.isConnected;
	}

	async uploadFileToServer(file: any) {
		if (!this.settings.isRegistered || !this.settings.syncOnChange) return;
		
		// Пропускаем файлы статуса синхронизации
		if (file.path.includes('📋 Статус синхронизации swiftStorm.md')) return;
		
		try {
			const content = await this.app.vault.read(file);
			
			const response = await fetch(`${this.settings.webhookUrl}/upload-file`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					username: this.settings.username,
					filePath: file.path,
					content: content
				})
			});

			if (response.ok) {
				console.log(`✅ Файл загружен на сервер: ${file.path}`);
			} else {
				console.error(`❌ Ошибка загрузки файла: ${file.path}`);
			}
		} catch (error) {
			console.error(`❌ Ошибка при загрузке файла ${file.path}:`, error);
		}
	}

	async deleteFileFromServer(file: any) {
		if (!this.settings.isRegistered || !this.settings.syncOnChange) return;
		
		// Пропускаем файлы статуса синхронизации
		if (file.path.includes('📋 Статус синхронизации swiftStorm.md')) return;
		
		try {
			const response = await fetch(`${this.settings.webhookUrl}/delete-file`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					username: this.settings.username,
					filePath: file.path
				})
			});

			if (response.ok) {
				console.log(`✅ Файл удален с сервера: ${file.path}`);
			} else {
				console.error(`❌ Ошибка удаления файла: ${file.path}`);
			}
		} catch (error) {
			console.error(`❌ Ошибка при удалении файла ${file.path}:`, error);
		}
	}

	async renameFileOnServer(file: any, oldPath: string) {
		if (!this.settings.isRegistered || !this.settings.syncOnChange) return;
		
		// Пропускаем файлы статуса синхронизации
		if (file.path.includes('📋 Статус синхронизации swiftStorm.md') || 
			oldPath.includes('📋 Статус синхронизации swiftStorm.md')) return;
		
		try {
			const content = await this.app.vault.read(file);
			
			const response = await fetch(`${this.settings.webhookUrl}/rename-file`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					username: this.settings.username,
					oldPath: oldPath,
					newPath: file.path,
					content: content
				})
			});

			if (response.ok) {
				console.log(`✅ Файл переименован на сервере: ${oldPath} -> ${file.path}`);
			} else {
				console.error(`❌ Ошибка переименования файла: ${oldPath} -> ${file.path}`);
			}
		} catch (error) {
			console.error(`❌ Ошибка при переименовании файла ${oldPath} -> ${file.path}:`, error);
		}
	}
}


// Настройки плагина
class swiftStormSettingTab extends PluginSettingTab {
	plugin: swiftStormRemoteVaultPlugin;

	constructor(app: App, plugin: swiftStormRemoteVaultPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'swiftStorm Remote Vault настройки'});

		// Статус подключения
		new Setting(containerEl)
			.setName("Статус подключения")
			.addText(text => text
				.setValue(this.plugin.settings.isRegistered ? "✅ Подключен" : "❌ Не подключен")
				.setDisabled(true));

		// Telegram Username
		new Setting(containerEl)
			.setName("Telegram Username")
			.setDesc("Ваш Telegram username (без @)")
			.addText(text => text
				.setPlaceholder("your_telegram_username")
				.setValue(this.plugin.settings.telegramUsername)
				.onChange(async (value) => {
					this.plugin.settings.telegramUsername = value;
					await this.plugin.saveSettings();
				}));

		// Username (только для чтения после регистрации)
		if (this.plugin.settings.username) {
			new Setting(containerEl)
				.setName("Username")
				.setDesc("Ваш username в системе swiftStorm (автоматически получен)")
				.addText(text => text
					.setValue(this.plugin.settings.username)
					.setDisabled(true));
		}

		// Webhook URL
		new Setting(containerEl)
			.setName("Webhook URL")
			.setDesc("URL webhook сервера для синхронизации")
			.addText(text => text
				.setPlaceholder("http://212.67.13.115:3005")
				.setValue(this.plugin.settings.webhookUrl)
				.onChange(async (value) => {
					this.plugin.settings.webhookUrl = value;
					await this.plugin.saveSettings();
				}));

		// Автосинхронизация
		new Setting(containerEl)
			.setName("Автосинхронизация при запуске")
			.setDesc("Автоматически синхронизировать хранилище при запуске Obsidian")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoSync)
				.onChange(async (value) => {
					this.plugin.settings.autoSync = value;
					await this.plugin.saveSettings();
				}));

		// Синхронизация при изменении
		new Setting(containerEl)
			.setName("Синхронизация при изменении")
			.setDesc("Автоматически синхронизировать при изменении файлов")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.syncOnChange)
				.onChange(async (value) => {
					this.plugin.settings.syncOnChange = value;
					await this.plugin.saveSettings();
				}));

		// Приоритет при конфликтах
		new Setting(containerEl)
			.setName("Приоритет при конфликтах")
			.setDesc("Какой файл оставлять при конфликте версий")
			.addDropdown(dropdown => dropdown
				.addOption('date', 'По дате изменения')
				.addOption('size', 'По размеру файла')
				.setValue(this.plugin.settings.conflictResolution)
				.onChange(async (value: 'size' | 'date') => {
					this.plugin.settings.conflictResolution = value;
					await this.plugin.saveSettings();
				}));

		// Время последней синхронизации
		if (this.plugin.settings.lastSyncTime > 0) {
			new Setting(containerEl)
				.setName("Последняя синхронизация")
				.addText(text => text
					.setValue(new Date(this.plugin.settings.lastSyncTime).toLocaleString())
					.setDisabled(true));
		}

		// Кнопка подключения
		if (!this.plugin.settings.isRegistered && this.plugin.settings.telegramUsername) {
			new Setting(containerEl)
				.setName("Подключение")
				.setDesc("Подключиться через Telegram")
				.addButton(btn => btn
					.setButtonText("Подключиться через Telegram")
					.onClick(() => {
						this.plugin.registerViaTelegram();
					}));
		}

		// Кнопка синхронизации
		if (this.plugin.settings.isRegistered) {
			new Setting(containerEl)
				.setName("Синхронизация")
				.setDesc("Синхронизировать хранилище с сервера")
				.addButton(btn => btn
					.setButtonText("Синхронизировать хранилище")
					.onClick(() => {
						this.plugin.syncVault();
					}));
		}
	}
}
