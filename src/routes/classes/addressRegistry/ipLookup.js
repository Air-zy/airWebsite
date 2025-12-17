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

  // Extracting Region
  const regionRegex = /<td>Region<\/td>\s*<td class="break-all">([^<]+)<\/td>/;
  const regionMatch = htmlSnippet.match(regionRegex);
  let region = regionMatch ? regionMatch[1] : null;

  if (region == null || region == " ") {
    const regionRegex2 =
      /<td>Region<\/td>\s*<td class="break-all">([^<]+)<\/td>/;
    const regionMatch2 = htmlSnippet2.match(regionRegex2);
    const region2 = regionMatch2 ? regionMatch2[1] : null;
    region = region2 + " ~";
  }

  // Extracting City
  const cityRegex = /<td>City<\/td>\s*<td class="break-all">([^<]+)<\/td>/;
  const cityMatch = htmlSnippet.match(cityRegex);
  let city = cityMatch ? cityMatch[1] : null;

  if (city == null || city == " ") {
    const cityRegex2 = /<td>City<\/td>\s*<td class="break-all">([^<]+)<\/td>/;
    const cityMatch2 = htmlSnippet2.match(cityRegex2);
    const city2 = cityMatch2 ? cityMatch2[1] : null;
    city = city2 + " ~";
  }
  
  // Extracting ISP
  const ISPRegex = /<td>ISP<\/td>\s*<td class="break-all">(.*?)<\/td>/;
  const ISPMatch2 = htmlSnippet2.match(ISPRegex);
  const ISP = ISPMatch2 ? ISPMatch2[1] : null;

  return {
    region,
    city,
    ISP
  }
}

module.exports = { ipLookup };