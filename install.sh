#!/bin/bash

# Скрипт установки swiftStorm плагина для Obsidian

echo "🚀 Установка swiftStorm Remote Vault плагина для Obsidian"
echo "=================================================="

# Определяем путь к vault
echo "📁 Введите путь к вашему Obsidian vault:"
echo "   Например: ~/Documents/Obsidian/MyVault"
echo "   Или нажмите Enter для поиска автоматически"
read -p "Путь к vault: " VAULT_PATH

# Если путь не указан, ищем автоматически
if [ -z "$VAULT_PATH" ]; then
    echo "🔍 Поиск vault автоматически..."
    
    # Ищем в стандартных местах
    POSSIBLE_PATHS=(
        "$HOME/Documents/Obsidian"
        "$HOME/Dropbox"
        "$HOME/Library/Mobile Documents/com~apple~CloudDocs"
        "$HOME/Google Drive"
    )
    
    for path in "${POSSIBLE_PATHS[@]}"; do
        if [ -d "$path" ]; then
            echo "Найдена папка: $path"
            ls -la "$path" | grep -E "\.obsidian|vault|notes" > /dev/null 2>&1
            if [ $? -eq 0 ]; then
                echo "Найден vault в: $path"
                VAULT_PATH="$path"
                break
            fi
        fi
    done
fi

# Проверяем, что путь существует
if [ ! -d "$VAULT_PATH" ]; then
    echo "❌ Ошибка: Папка vault не найдена: $VAULT_PATH"
    echo "Пожалуйста, укажите правильный путь к вашему Obsidian vault"
    exit 1
fi

# Создаем папку plugins если её нет
PLUGINS_DIR="$VAULT_PATH/.obsidian/plugins"
if [ ! -d "$PLUGINS_DIR" ]; then
    echo "📁 Создаем папку plugins..."
    mkdir -p "$PLUGINS_DIR"
fi

# Копируем плагин
PLUGIN_NAME="swiftstorm-remote-vault"
PLUGIN_DIR="$PLUGINS_DIR/$PLUGIN_NAME"

echo "📦 Копируем плагин в: $PLUGIN_DIR"

# Удаляем старую версию если есть
if [ -d "$PLUGIN_DIR" ]; then
    echo "🗑️ Удаляем старую версию плагина..."
    rm -rf "$PLUGIN_DIR"
fi

# Копируем новую версию
cp -r . "$PLUGIN_DIR"

# Удаляем ненужные файлы
echo "🧹 Очищаем ненужные файлы..."
cd "$PLUGIN_DIR"
rm -rf node_modules package-lock.json tsconfig.json esbuild.config.mjs

echo "✅ Плагин успешно установлен!"
echo ""
echo "📋 Следующие шаги:"
echo "1. Перезапустите Obsidian"
echo "2. Откройте Settings → Community plugins"
echo "3. Отключите 'Safe mode'"
echo "4. Найдите 'swiftStorm Remote Vault' в списке"
echo "5. Включите плагин"
echo ""
echo "🔧 Для настройки:"
echo "- Откройте Settings → swiftStorm Remote Vault"
echo "- Введите данные сервера: 212.67.13.115:22"
echo "- Укажите ваш username и password"
echo ""
echo "🚀 Для использования:"
echo "- Нажмите Ctrl/Cmd + Shift + P"
echo "- Выберите 'swiftStorm Remote Vault: Быстрое подключение по username'"
echo ""
echo "📖 Подробная документация: INSTALL_SIMPLE.md"

