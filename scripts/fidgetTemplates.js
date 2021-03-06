﻿/*
 * Software License Agreement (Apache License)
 *
 * Copyright (c) 2016, PPM AS
 * Contact: laszlo.nagy@ppmas.no
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
 
fidgetService.$inject = ['enumService', 'variableService', 'colorPickerService', 'scriptManagerService'];

function fidgetService(enumService, variableService, colorPickerService, scriptManagerService) {
    var fidgets = {
        getFidget: function (root, source, left, top, properties, icon, name) {
            var result = {
                root: root,
                source: source,
                left: left,
                top: top,
                properties: angular.copy(properties),
                icon: icon,
                name: name
            };

            if (result.source == "fidgetGroup") {
                result.fidgets = [];
            }

            fidgets.defineProperties(result);

            return result;
        },

        //generate new uid
        guid: function () {
            function s4() {
                return Math.floor((1 + Math.random()) * 0x10000)
                  .toString(16)
                  .substring(1);
            }
            return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
              s4() + '-' + s4() + s4() + s4();
        },

        //stores if the property is a script or not
        //determining this costs a lot, we should not repeat
        scriptDict: {},

        //define properties for "private" (props starts with '_') members and sets up the comm. with the device
        defineProperties: function (fidget) {
            //generate unique id for the fidget if it is null
            if (!fidget.id)
                fidget.id = "fidget_" + this.guid();

            if (!fidget.template) {
                for (var k in fidgets.templates) {
                    if (fidgets.templates[k].name == fidget.name) {
                        fidget.template = fidgets.templates[k];
                        break;
                    }
                }
            }

            var fidgetGet = function (properties, propertyName) {
                function isFloat(n) {
                    return n === Number(n) && n % 1 !== 0;
                }

                function isInteger(n) {
                    return n === Number(n) && n % 1 === 0;
                }

                function isBoolan(b) {
                    //var val = JSON.parse(JSON.stringify(b));
                    return (b == true || b == false || b == "true" || b == "false") && b != "";
                }

                var currentValue = properties[propertyName];
                if (!(currentValue in fidgets.scriptDict)) {
                    if (variableService == undefined || currentValue === 0)
                        fidgets.scriptDict[currentValue] = false;
                    else {
                        try {
                            eval(scriptManagerService.compile(currentValue));
                            fidgets.scriptDict[currentValue] = true;
                        }
                        catch (e) {
                            fidgets.scriptDict[currentValue] = false;
                        }
                    }
                }

                if (fidgets.scriptDict[currentValue]) {
                    var value = eval(scriptManagerService.compile(currentValue));
                    if (isFloat(value)) {
                        return Number(Number(value).toFixed(3));
                    } else if (isInteger(value)) {
                        return Number(value);
                    } else if (isBoolan(value)) {
                        return value == "true" || value == true;
                    }
                    else {
                        return decodeURI(value);
                    }
                }
                else
                    return currentValue;
            };

            var fidgetSet = function (properties, propertyName, v) {
                //if the _value is empty, we can return
                if (properties[propertyName] == "") {
                    return;
                }

                try {
                    if (eval("typeof " + properties[propertyName] + " == 'string'")) {
                        eval(properties[propertyName] + "= \"" + encodeURI(v) + "\"");
                    } else {
                        eval(properties[propertyName] + "= " + v);
                    }

                } catch (e) {
                    properties[propertyName] = v;
                }
            };

            for (var property in fidget.properties) {
                if (property.lastIndexOf("_", 0) === 0) {

                    //private property, create public getter setter for the angular ng-model 2 way binding. 
                    //with the getter we can get the value from the device if possible
                    //with the setter we can update the value on the device if possible

                    //The definition is done this way to have definition-time info about the calling variable. 
                    //Without this we would not know who called the getter as 'this' refers to the object itself, not the getter or the property.
                    var definePropertyfidget = "Object.defineProperty(fidget.properties, property.substring(1), {";
                    definePropertyfidget += "get: function () { return fidgetGet(this, \"" + property + "\")},";
                    definePropertyfidget += "set: function (v) { return fidgetSet(this, \"" + property + "\", v)}})";

                    eval(definePropertyfidget);
                }
            }
        },

        getTemplate: function (root, source, properties, forScreenType, icon, name, propertyLabels) {
            var template = {
                root: root,
                icon: icon,
                forScreenType: forScreenType,
                source: source,
                hidden: forScreenType == enumService.screenTypesEnum.Factory,
                properties: properties,
                name: name ? localization.currentLocal.fidgets[name] : localization.currentLocal.fidgets[source],
                propertyLabels: propertyLabels
            };

            fidgets.defineProperties(template);

            return template;
        }
    };

    fidgets.templates = {
        "fidgetGroup": fidgets.getTemplate("views/fidgets/", "fidgetGroup", { _width: 200, _height: 200, _color: '#D1D1D1', opacity: 0.7 }, enumService.screenTypesEnum.All, "images/fidgets/box.png"),
        "progressBar": fidgets.getTemplate("views/fidgets/", "progressBar", { _width: 100, _height: 30, _value: "variableService.demo.int", _color: '#ff0000' }, enumService.screenTypesEnum.Normal),
        "button": fidgets.getTemplate("views/fidgets/", "button", { _width: 100, _height: 30, _text: "Click me", onClick: "#message('Default button action.')" }, enumService.screenTypesEnum.Normal),
        "checkBox": fidgets.getTemplate("views/fidgets/", "checkBox", { _width: 100, _height: 30, _text: "Check me", _value: "variableService.demo.bool", _fontColor: "#000000" }, enumService.screenTypesEnum.Normal),
        "textInput": fidgets.getTemplate("views/fidgets/", "textInput", { _width: 100, _height: 30, _text: "variableService.demo.string" }, enumService.screenTypesEnum.Normal, "images/fidgets/textinput.png"),
        "text": fidgets.getTemplate("views/fidgets/", "text", { _width: 100, _height: 25, _fontSize: 16, _color: "#000000", _text: "variableService.demo.string"}, enumService.screenTypesEnum.All, "images/fidgets/text.png"),
        "scrollableText": fidgets.getTemplate("views/fidgets/", "scrollableText", { _width: 100, _height: 100, _text: "variableService.demo.string" }, enumService.screenTypesEnum.All, "images/fidgets/multilinetext.png"),
        "slider": fidgets.getTemplate("views/fidgets/", "slider", { _width: 100, _height: 30, _value: "variableService.demo.int", _min: 0, _max: 100, _step: 0.1 }, enumService.screenTypesEnum.Normal),
        "radioButton": fidgets.getTemplate("views/fidgets/", "radioButton", { _width: 100, _height: 100, _value: "'Option1'", _options: 'Option1,Option2,Option3', _fontColor: "#000000" }, enumService.screenTypesEnum.Normal),
        "fullgauge": fidgets.getTemplate("views/fidgets/", "gauge", { _width: 80, _height: 80, _value: "variableService.demo.int", _color: '#ff0000', _angleOffset: 0, _angleArc: 360, _step: 0.1, _min: 5.0, _max: 100.0, _lock: false }, enumService.screenTypesEnum.Normal),
        "boolean": fidgets.getTemplate("views/fidgets/", "boolean", { _width: 100, _height: 30, _text: "Bool value", _value: "variableService.demo.bool" }, enumService.screenTypesEnum.Normal),
        "image": fidgets.getTemplate("views/fidgets/", "image", { _width: 100, _height: 100, _value: "variableService.demo.image", scale: 'aspectFit' }, enumService.screenTypesEnum.Normal),
        "indicatorLamp": fidgets.getTemplate("views/fidgets/", "indicatorLamp", { _width: 100, _height: 30, _text: "Indicate", _value: "variableService.demo.bool", _onColor: '#00ff00', _offColor: '#ff0000', _fontColor: "#000000", _blinking: false, _blinkPeriod: 1 }, enumService.screenTypesEnum.Normal),
    };

    return fidgets;
}