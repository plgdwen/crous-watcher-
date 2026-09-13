import 'dotenv/config';
import express from 'express';
import * as cheerio from 'cheerio';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const TARGET_URL = process.env.TARGET_URL;
const LOCATION_NAME = process.env.LOCATION_NAME || 'la zone surveillée';
const CHECK_INTERVAL_MS = Number(process.env.CHECK_INTERVAL_MS || 60000);
const EMAIL_TO = process.env.EMAIL_TO;

if (!TARGET_URL) {
  console.error("Erreur de configuration : TARGET_URL est manquant dans les variables d'environnement.");
  process.exit(1);
}

// --- Envoi d'email ---
let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
} else {
  console.warn("SMTP non configuré : les notifications seront seulement écrites dans les logs du serveur.");
}

async function sendNotification(subject, text) {
  console.log(`[NOTIFICATION] ${subject} — ${text}`);
  if (!transporter || !EMAIL_TO) return;
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: EMAIL_TO,
      subject,
      text,
    });
  } catch (err) {
    console.error("Échec de l'envoi de l'email :", err.message);
  }
}

// --- État partagé, lu par la page de statut ---
const state = {
  lastCheck: null,
  lastStatus: 'inconnu', // 'libre' | 'aucun_logement' | 'erreur'
  lastError: null,
  hasNotifiedForCurrentAvailability: false,
  checksCount: 0,
  startedAt: new Date(),
};

const NO_RESULT_PATTERN = /Aucun logement trouv[ée]/i;

async function checkOnce() {
  state.checksCount += 1;
  state.lastCheck = new Date();

  try {
    const response = await fetch(TARGET_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CrousWatcher/1.0)',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
    });

    if (!response.ok) {
      throw new Error(`Réponse HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const bodyText = $('body').text();
    const noResult = NO_RESULT_PATTERN.test(bodyText);

    if (noResult) {
      state.lastStatus = 'aucun_logement';
      state.lastError = null;
      state.hasNotifiedForCurrentAvailability = false;
    } else {
      state.lastStatus = 'libre';
      state.lastError = null;

      if (!state.hasNotifiedForCurrentAvailability) {
        state.hasNotifiedForCurrentAvailability = true;
        await sendNotification(
          `Logement disponible – ${LOCATION_NAME}`,
          [
            `Un logement semble disponible pour "${LOCATION_NAME}".`,
            '',
            `Vérifie ici : ${TARGET_URL}`,
            '',
            `Détecté le ${state.lastCheck.toLocaleString('fr-FR')}.`,
          ].join('\n')
        );
      }
    }
  } catch (err) {
    state.lastStatus = 'erreur';
    state.lastError = err.message;
    console.error('Erreur pendant la vérification :', err.message);
  }
}

// Première vérification immédiate, puis boucle toutes les CHECK_INTERVAL_MS
checkOnce();
setInterval(checkOnce, CHECK_INTERVAL_MS);

// --- Routes ---
app.use(express.static(path.join(__dirname, 'public')));

// Utilisé par un service externe (UptimeRobot, cron-job.org) pour garder le service éveillé
app.get('/health', (req, res) => {
  res.json({ ok: true, uptimeSeconds: Math.floor(process.uptime()) });
});

app.get('/api/status', (req, res) => {
  res.json({
    targetUrl: TARGET_URL,
    locationName: LOCATION_NAME,
    checkIntervalMs: CHECK_INTERVAL_MS,
    startedAt: state.startedAt,
    lastCheck: state.lastCheck,
    lastStatus: state.lastStatus,
    lastError: state.lastError,
    checksCount: state.checksCount,
  });
});

app.listen(PORT, () => {
  console.log(`Crous Watcher lancé sur le port ${PORT}`);
});
