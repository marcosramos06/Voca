/* Creates a key pair for web push on this device only. */
const toUrl = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
document.getElementById("make").addEventListener("click", async () => {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  document.getElementById("pub").value = toUrl(raw);
  document.getElementById("priv").value = jwk.d;
  document.getElementById("out").hidden = false;
});
