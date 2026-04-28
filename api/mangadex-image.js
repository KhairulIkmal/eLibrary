module.exports = async function handler(req, res) {
  const target = req.query.url;

  if (!target || !target.startsWith('https://uploads.mangadex.org/')) {
    return res.status(400).end('Invalid URL');
  }

  try {
    const response = await fetch(target, {
      headers: {
        'Referer':    'https://mangadex.org/',
        'User-Agent': 'Mozilla/5.0'
      }
    });

    if (!response.ok) return res.status(response.status).end('Upstream error');

    const buffer      = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 's-maxage=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    res.status(500).end(err.message);
  }
};
