const roUNameIDcache = {};

async function idtoname(userId) {
    const isCached = roUNameIDcache[userId];
    if (isCached) {
        return isCached;
    }

    const response = await fetch(`https://users.roblox.com/v1/users/${userId}`);
    if (!response.ok) {
          throw new Error(`Failed to fetch user data from ${response.url}: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    roUNameIDcache[userId] = data
    return data
}

module.exports = { idtoname };