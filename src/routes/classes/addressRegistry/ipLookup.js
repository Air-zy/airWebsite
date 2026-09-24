async function ipLookup(ipString) {
   const ipftech = await fetch("https://check-host.net/ip-info?host=" + ipString, {
    headers: {
      accept: "*/*",
      "accept-language": "en-CA,en-GB;q=0.9,en-US;q=0.8,en;q=0.7",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
       Referer: "https://check-host.net/",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
    body: null,
    method: "GET",
  });
  const htmlContent = await ipftech.text();

  const startIndex = htmlContent.indexOf('<a href="#ip_info-geolite2">');
  const endIndex = htmlContent.indexOf(
    'Powered by <a target="_blank" rel="nofollow" href="https://www.maxmind.com">MaxMind GeoIP</a>'
  );

  const startIndex2 = htmlContent.indexOf('<a href="#ip_info-dbip">');
  const endIndex2 = htmlContent.indexOf(
    'Powered by <a target="_blank" rel="nofollow" href="https://db-ip.com">DB-IP</a>'
  );

  // Extract the MaxMind section using string splicing
  const htmlSnippet = htmlContent.substring(startIndex, endIndex);
  const htmlSnippet2 = htmlContent.substring(startIndex2, endIndex2);

  // maxmind first, db-ip when it has nothing. the ~ marks a db-ip value
  const field = name => {
    const regex = new RegExp(`<td>${name}</td>\\s*<td class="break-all">([^<]+)</td>`);
    const value = htmlSnippet.match(regex)?.[1] ?? null;
    if (value != null && value != " ") return value;
    return (htmlSnippet2.match(regex)?.[1] ?? null) + " ~";
  };

  const region = field('Region');
  const city = field('City');

  const ISPRegex = /<td>\s*ISP\s*\/\s*Org\s*<\/td>\s*<td class="break-all">\s*(.*?)\s*<\/td>/s;
  const ISPMatch2 = htmlSnippet2.match(ISPRegex);
  const ISP = ISPMatch2 ? ISPMatch2[1] : null;

  return {
    region,
    city,
    ISP
  }
}

module.exports = { ipLookup };