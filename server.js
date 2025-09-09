const express = require('express');
const { NodeSSH } = require('node-ssh');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8080;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Хранилище подключений
const connections = new Map();

// Тестовое подключение
app.post('/test', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        const ssh = new NodeSSH();
        await ssh.connect({
            host: '212.67.13.115',
            port: 22,
            username: username,
            password: password,
            readyTimeout: 10000
        });
        
        // Проверяем доступ к папке пользователя
        const userPath = `/root/bot/vault/${username}`;
        const exists = await ssh.execCommand(`test -d "${userPath}" && echo "exists"`);
        
        if (exists.stdout === 'exists') {
            connections.set(username, ssh);
            res.json({ success: true, message: 'Подключение успешно' });
        } else {
            ssh.dispose();
            res.status(404).json({ success: false, error: 'Папка пользователя не найдена' });
        }
    } catch (error) {
        console.error('Ошибка подключения:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Получение списка файлов
app.post('/list', async (req, res) => {
    const { username, password, path: remotePath } = req.body;
    
    try {
        let ssh = connections.get(username);
        
        if (!ssh) {
            ssh = new NodeSSH();
            await ssh.connect({
                host: '212.67.13.115',
                port: 22,
                username: username,
                password: password,
                readyTimeout: 10000
            });
            connections.set(username, ssh);
        }
        
        const userPath = `${remotePath}/${username}`;
        
        // Получаем список всех .md файлов
        const result = await ssh.execCommand(`find "${userPath}" -type f -name "*.md"`);
        const files = result.stdout.split('\n').filter(f => f.trim());
        
        const fileList = [];
        
        for (const filePath of files) {
            try {
                // Читаем содержимое файла
                const content = await ssh.execCommand(`cat "${filePath}"`);
                const relativePath = filePath.replace(userPath, '').replace(/^\//, '');
                
                fileList.push({
                    name: relativePath,
                    content: content.stdout,
                    path: filePath
                });
            } catch (fileError) {
                console.error(`Ошибка чтения файла ${filePath}:`, fileError);
            }
        }
        
        res.json({ success: true, files: fileList });
    } catch (error) {
        console.error('Ошибка получения файлов:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Загрузка файла на сервер
app.post('/upload', async (req, res) => {
    const { username, password, filePath, content } = req.body;
    
    try {
        let ssh = connections.get(username);
        
        if (!ssh) {
            ssh = new NodeSSH();
            await ssh.connect({
                host: '212.67.13.115',
                port: 22,
                username: username,
                password: password,
                readyTimeout: 10000
            });
            connections.set(username, ssh);
        }
        
        const userPath = `/root/bot/vault/${username}`;
        const fullPath = `${userPath}/${filePath}`;
        
        // Создаем директорию если нужно
        const dir = path.dirname(fullPath);
        await ssh.execCommand(`mkdir -p "${dir}"`);
        
        // Записываем файл
        await ssh.putBuffer(Buffer.from(content), fullPath);
        
        res.json({ success: true, message: 'Файл загружен' });
    } catch (error) {
        console.error('Ошибка загрузки файла:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Удаление файла
app.post('/delete', async (req, res) => {
    const { username, password, filePath } = req.body;
    
    try {
        let ssh = connections.get(username);
        
        if (!ssh) {
            ssh = new NodeSSH();
            await ssh.connect({
                host: '212.67.13.115',
                port: 22,
                username: username,
                password: password,
                readyTimeout: 10000
            });
            connections.set(username, ssh);
        }
        
        const userPath = `/root/bot/vault/${username}`;
        const fullPath = `${userPath}/${filePath}`;
        
        await ssh.execCommand(`rm -f "${fullPath}"`);
        
        res.json({ success: true, message: 'Файл удален' });
    } catch (error) {
        console.error('Ошибка удаления файла:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Отключение
app.post('/disconnect', (req, res) => {
    const { username } = req.body;
    
    const ssh = connections.get(username);
    if (ssh) {
        ssh.dispose();
        connections.delete(username);
    }
    
    res.json({ success: true, message: 'Отключено' });
});

app.listen(PORT, () => {
    console.log(`SFTP Server running on port ${PORT}`);
});
