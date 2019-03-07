odoo.define('web_editor.jquery', function (require) {
'use strict';

return function () {
    throw new Error("Use jquery lib prohibited in the editor");
};

});

odoo.define('web_editor._', function (require) {
'use strict';

return function () {
    throw new Error("Use underscore lib prohibited in the editor");
};

});
