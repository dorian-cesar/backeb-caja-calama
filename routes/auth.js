const express = require('express');
const bcrypt = require('bcrypt');
const path = require('path');
const db = require('../db_config/db.js');
const authController = require('../src/controllers/authController');

const router = express.Router();

router.post('/login', authController.login);
router.get('/logout', authController.logout);

// Mostrar formulario de registro
router.get('/registro', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'views', 'registro.html'));
});

// Procesar registro
router.post('/registro', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [existing] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.send(`<script>alert("Usuario ya existe"); window.location.href="/registro";</script>`);
    }

    const hashed = await bcrypt.hash(password, 10);
    await db.execute('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashed]);

    res.send(`<script>alert("Usuario creado exitosamente"); window.location.href="/";</script>`);
  } catch (err) {
    console.error('Error al registrar:', err);
    res.status(500).send('Error en el servidor');
  }
});

module.exports = router;