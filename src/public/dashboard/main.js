let buffer = '';

  // --- Button click reads clipboard once ---
  document.getElementById('pasteBtn').addEventListener('click', async () => {
    try {
      // readText() is allowed in a user gesture
      const text = await navigator.clipboard.readText();
      buffer = text;                // store in heap only
      console.log('Pasted content:', buffer);
      // TODO: do something with `buffer`—send it to server, encrypt, etc.
    } catch (err) {
      console.error('Clipboard read failed:', err);
    }
  });