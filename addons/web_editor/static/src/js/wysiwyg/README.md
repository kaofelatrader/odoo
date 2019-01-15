WIP README for the WIP library.

# Webodootor

Webodootor is a JavaScript library that helps you create and customize a WYSIWYG editor in a web browser.

It was created by Odoo SA and is maintained in a joined effort with the open source community.

### Installation

#### 1. Clone this repository

Clone this repository into your-project-root/static/src/lib/webodootor:

```bash
cd your-project-root
git clone <URL> static/src/lib/webodootor
```

#### 2. Include JS/CSS

Include the following code in the `<head>` tag of your HTML:

```html
<script type="text/javascript" src="static/src/lib/webodootor/<ALL-JS>"/>
<link rel="stylesheet" type="text/css" src="static/src/lib/webodootor/<ALL-CSS>"/>
```

#### 3. Instantiate Webodootor

Include the following code at the bottom of the `<body>` tag of your HTML:

```html
<script type="text/javascript">
    odoo.define('my_project.webodootor', function (require) {
        'use strict';

        var Wysiwyg = require('web_editor.wysiwyg');

        return new Wysiwyg();
    });
</script>
```

### Customize

There are many options you can customize simply by overloading 

### Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.

### License

MIT?
