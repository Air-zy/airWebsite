async function apiWait() {
  //return new Promise(resolve => setTimeout(resolve, 600));
  return new Promise(resolve => setTimeout(resolve, 800));
}

async function myCustomGet(baseUrl, params = {}) {
  const queryString = Object.entries(params)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    )
    .join('&');

  const url = `${baseUrl}?${queryString}`;
  const response = await fetch(url, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  return await response.json();
}

async function getRecomendations(mal_id) {
  await apiWait();
  const recoms = [];
  const res = await fetch(
    `https://api.jikan.moe/v4/anime/${mal_id}/recommendations`
  );
  const recomJson = await res.json();
  if (recomJson.data) {
    let count = 0;
    for (const rcm of recomJson.data) {
      if (count >= 6) break; // stop after 6
      recoms.push({
        id: rcm.entry.mal_id,
        v: rcm.votes,
      });
      count++;
    }
  }
  return recoms;
}

async function GetReviews(mal_id) {
  await apiWait();
  const reviews = [];
  const res = await fetch(`https://api.jikan.moe/v4/anime/${mal_id}/reviews`);
  const reviewsJson = await res.json();
  const reviewData = reviewsJson.data;

  if (reviewData) {
    reviewData.sort((a, b) => a.score - b.score);
    let bigReview = '';
    for (const rvw of reviewData) {
      const text = rvw.review ?? '';
      if (bigReview.length + text.length <= 1024) {
        bigReview += text;
      } else {
        bigReview += text.slice(0, 1024 - bigReview.length);
        break;
      }
    }

    return bigReview;
  }
}

async function parseAnimeData(anime) {
  if (anime.score < 5 || anime.favorites < 40) {
    return;
  }
  const mal_id = anime.mal_id;
  const recoms = await getRecomendations(mal_id);
  if (recoms.length === 0) {
    return;
  }

  const review = await GetReviews(mal_id);
  if (review == null || review === '') {
    return;
  }

  return {
    name: anime.title,
    score: anime.score,
    recoms: recoms,
    review: review,
  };
}

async function processPageData(animeMap, pageData) {
  for (const anime of pageData) {
    const animeData = await parseAnimeData(anime);
    if (animeData) {
      animeMap.set(anime.mal_id, animeData);
    }
  }
}

async function seasonsNow(animeMap, mpage) {
  const params = {
    //filter: 'favorite',
    //rating: 'r',
    sfw: false,
    limit: 25,
    page: mpage,
  };

  console.log('pg:', mpage, 'mapSz:', animeMap.size);
  try {
    await apiWait();
    const response = await myCustomGet(
      'https://api.jikan.moe/v4/seasons/now',
      params
    );
    await processPageData(animeMap, response.data);
    if (response.pagination && response.pagination.has_next_page) {
      await seasonsNow(animeMap, mpage + 1);
    }
  } catch (err) {
    console.warn(err);
    await seasonsNow(animeMap, mpage); // retry
  }
}

async function animesTopR17() {
  const params = {
    filter: 'favorite',
    rating: 'r17',
    sfw: false,
    limit: 25,
    page: mpage,
  };

  console.log('r17 pg:', mpage, 'mapSz:', animeMap.size);
  try {
    await apiWait();
    const response = await myCustomGet(
      'https://api.jikan.moe/v4/top/anime',
      params
    );
    await processPageData(animeMap, response.data);
    if (response.pagination && response.pagination.has_next_page) {
      await animesTopR17(animeMap, mpage + 1);
    }
  } catch (err) {
    console.warn(err);
    await animesTopR17(animeMap, mpage); // retry
  }
}

async function animesTopPg13() {
  const params = {
    filter: 'favorite',
    rating: 'pg13',
    sfw: false,
    limit: 25,
    page: mpage,
  };

  console.log('pg13 pg:', mpage, 'mapSz:', animeMap.size);
  try {
    await apiWait();
    const response = await myCustomGet(
      'https://api.jikan.moe/v4/top/anime',
      params
    );
    await processPageData(animeMap, response.data);
    if (response.pagination && response.pagination.has_next_page) {
      await animesTopPg13(animeMap, mpage + 1);
    }
  } catch (err) {
    console.warn(err);
    await animesTopPg13(animeMap, mpage); // retry
  }
}

async function animesTopR() {
  const params = {
    filter: 'favorite',
    rating: 'r',
    sfw: false,
    limit: 25,
    page: mpage,
  };

  console.log('topr pg:', mpage, 'mapSz:', animeMap.size);
  try {
    await apiWait();
    const response = await myCustomGet(
      'https://api.jikan.moe/v4/top/anime',
      params
    );
    await processPageData(animeMap, response.data);
    if (response.pagination && response.pagination.has_next_page) {
      await animesTopR(animeMap, mpage + 1);
    }
  } catch (err) {
    console.warn(err);
    await animesTopR(animeMap, mpage); // retry
  }
}

const { setAnimeData } = require('../DATABASE/utilDB.js');
async function init() {
  console.log('[anime] starting');

  const animeMap = new Map();

  console.log('[anime] starting seasonsNow');
  await seasonsNow(animeMap, 1);
  console.log('[anime] starting TopR17');
  await animesTopR17(animeMap, 1);
  console.log('[anime] starting TopPg13');
  await animesTopPg13(animeMap, 1);
  console.log('[anime] starting TopR');
  await animesTopR(animeMap);

  console.log('[anime done]');//, animeMap);
  setAnimeData(animeMap)
}

module.exports = {init}