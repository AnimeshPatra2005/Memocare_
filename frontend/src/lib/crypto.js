// src/lib/crypto.js

/**
 * Derives a 256-bit AES-GCM key from a password using PBKDF2.
 * @param {string} password - User's password
 * @param {string} email - Used as a salt (unique per user)
 */
export async function deriveKeyFromPassword(password, email) {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    const saltBuffer = encoder.encode(email.toLowerCase());

    // Import the password as a raw key material
    const baseKey = await window.crypto.subtle.importKey(
        "raw",
        passwordBuffer,
        "PBKDF2",
        false,
        ["deriveKey"]
    );

    // Derive the AES-GCM key
    return window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: saltBuffer,
            iterations: 100000,
            hash: "SHA-256",
        },
        baseKey,
        { name: "AES-GCM", length: 256 },
        false, // Prevent key from being exported/read by XSS scripts
        ["encrypt", "decrypt"]
    );
}

/**
 * Encrypts a plaintext string using AES-GCM.
 * @param {string} plaintext 
 * @param {CryptoKey} key 
 */
export async function encryptData(plaintext, key) {
    const encoder = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 12-byte IV is standard for GCM

    const ciphertext = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        encoder.encode(plaintext)
    );

    // Return base64 encoded strings to send over JSON API
    return {
        ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
        iv: btoa(String.fromCharCode(...iv))
    };
}

/**
 * Decrypts a base64 encoded ciphertext using AES-GCM.
 * @param {string} ciphertextBase64 
 * @param {string} ivBase64 
 * @param {CryptoKey} key 
 */
export async function decryptData(ciphertextBase64, ivBase64, key) {
    const decoder = new TextDecoder();
    const ciphertext = Uint8Array.from(atob(ciphertextBase64), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));

    const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        ciphertext
    );

    return decoder.decode(decryptedBuffer);
}
