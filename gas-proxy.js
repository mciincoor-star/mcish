// ═══════════════════════════════════════════════════════════════════
// MCISH — Netlify Serverless Function: GAS Proxy
// File: netlify/functions/gas-proxy.js
//
// Fungsi ini menjadi perantara antara browser (frontend) dan
// Google Apps Script (backend Google Sheets).
// Mengatasi masalah CORS yang terjadi jika browser langsung
// memanggil URL Apps Script.
// ═══════════════════════════════════════════════════════════════════

exports.handler = async function (event, context) {

  // ── CORS headers — izinkan semua origin ──────────────────────────
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  // ── Preflight OPTIONS request ─────────────────────────────────────
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  // ── Baca URL Google Apps Script dari environment variable ─────────
  const GAS_URL = process.env.GAS_URL;

  if (!GAS_URL) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: "GAS_URL environment variable belum dikonfigurasi di Netlify.",
      }),
    };
  }

  try {
    let targetUrl = GAS_URL;
    let fetchOptions = {};

    // ── GET request (ping / getUserByEmail / getDocuments) ────────────
    if (event.httpMethod === "GET") {
      const qs = event.queryStringParameters
        ? new URLSearchParams(event.queryStringParameters).toString()
        : "";
      targetUrl = qs ? `${GAS_URL}?${qs}` : GAS_URL;

      fetchOptions = {
        method: "GET",
        redirect: "follow",
      };
    }
    // ── POST request (submitDocument / registerUser / updateStatus) ───
    else if (event.httpMethod === "POST") {
      fetchOptions = {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: event.body,
        redirect: "follow",
      };
    } else {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ success: false, error: "Method not allowed" }),
      };
    }

    // ── Panggil Google Apps Script ────────────────────────────────────
    const gasResponse = await fetch(targetUrl, fetchOptions);
    const text = await gasResponse.text();

    // Parse JSON dari GAS; jika gagal, kembalikan teks mentah
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { success: true, raw: text };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data),
    };
  } catch (err) {
    console.error("GAS Proxy Error:", err);
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({
        success: false,
        error: "Gagal menghubungi Google Apps Script: " + err.message,
      }),
    };
  }
};
