# Простая установка swiftStorm плагина

## 🚀 Быстрая установка

1. **Скопируйте папку плагина**
   ```bash
   cp -r obsidian-mdpa-plugin ~/Documents/Obsidian/YourVault/.obsidian/plugins/swiftstorm-remote-vault
   ```

2. **Переименуйте папку** (если нужно)
   ```bash
   mv ~/Documents/Obsidian/YourVault/.obsidian/plugins/obsidian-mdpa-plugin ~/Documents/Obsidian/YourVault/.obsidian/plugins/swiftstorm-remote-vault
   ```

3. **Перезапустите Obsidian**

4. **Включите плагин**
   - Откройте Settings → Community plugins
   - Отключите "Safe mode"
   - Найдите "swiftStorm Remote Vault" в списке
   - Включите плагин

## ⚙️ Настройка

1. **Откройте настройки плагина**
   - Settings → swiftStorm Remote Vault

2. **Введите данные сервера**
   - Сервер: `212.67.13.115`
   - Порт: `22`
   - Username: ваш username
   - Password: ваш password

## 🔧 Использование

### Быстрое подключение
1. Нажмите `Ctrl/Cmd + Shift + P`
2. Выберите "swiftStorm Remote Vault: Быстрое подключение по username"
3. Введите username и password
4. Нажмите "Подключиться"

### Полное подключение
1. Нажмите `Ctrl/Cmd + Shift + P`
2. Выберите "swiftStorm Remote Vault: Подключиться к swiftStorm хранилищу"
3. Заполните все поля
4. Нажмите "Подключиться"

## 📁 Структура файлов

После подключения в вашем vault появится папка `swiftstorm-{username}` со следующей структурой:

```
swiftstorm-{username}/
├── inbox/           # Входящие файлы
├── archive/         # Архивные файлы
├── profiles/        # Профили
├── events/          # События
└── shared/          # Общие папки
```

## 🔒 Безопасность

- Пароли сохраняются локально в настройках Obsidian
- Подключение происходит через защищенный SFTP протокол
- Данные передаются в зашифрованном виде

## 🚨 Устранение неполадок

### Плагин не загружается
1. Проверьте, что папка называется `swiftstorm-remote-vault`
2. Убедитесь, что файл `main.js` существует
3. Проверьте консоль на ошибки (Ctrl/Cmd + Shift + I)

### Ошибка подключения
1. Проверьте правильность username и password
2. Убедитесь, что сервер доступен: `ping 212.67.13.115`
3. Проверьте, что порт 22 открыт

### Файлы не синхронизируются
1. Убедитесь, что папка пользователя существует на сервере
2. Проверьте права доступа к папке
3. Обратитесь к администратору swiftStorm

## 📞 Поддержка

При возникновении проблем:
1. Проверьте раздел "Устранение неполадок"
2. Обратитесь к администратору swiftStorm
3. Создайте issue в репозитории плагина

