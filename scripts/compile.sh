#!/bin/bash

# build game templates for client side
./node_modules/pug-cli/index.js -c --name newFormTemplate -o public/javascripts/templates/skill views/skill/modalNewForm.pug
./node_modules/pug-cli/index.js -c --name editFormTemplate -o public/javascripts/templates/skill views/skill/modalEditForm.pug

./node_modules/pug-cli/index.js -c --name-after-file -o public/javascripts/templates/character views/character/templates/*.pug

./node_modules/pug-cli/index.js -c --name-after-file -o public/javascripts/templates views/clientPartials/*.pug
