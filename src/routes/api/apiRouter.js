const express = require('express');
const router = express.Router();

router.get('/rowa/fights/recent',  require('./rowa2/getFightsRecent.js')   );
router.get('/rowa/fights/:id',     require('./rowa2/getFightById.js')      );
router.get('/rowa/fights',         require('./rowa2/rowa_all_fights.js')   );
router.get('/rowa/all',            require('./rowa2/allPlrData.js')        );
router.get('/rowa/:userid',        require('./rowa2/plrData.js')           );

router.post('/rowadb/fights',      require('./rowa2/rowa_fights.js')       );


router.get('/anime2/data',         require('./anime2/data.js')         );
router.get('/rblx',                require('./api_rblx.js')                );
router.get('/logs',                require('./api_logs.js')                );
router.get('/projects',            require('./api_projects.js')            );
router.get('/headers',             require('./api_headers.js')             );
router.get('/cluster-units',       require('./api_clusterUnits.js')        );

router.post('/project-edit',       require('./api_project_edit.js')        );
router.post('/get-anime',          require('./anime/get_anime.js')         );
router.post('/commit-anime',       require('./anime/commit_anime.js')      );
router.post('/projects-update',    require('./projects_update.js')         );

module.exports = router;
