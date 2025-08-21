// file: discourse-lottery-v3/assets/javascripts/discourse/initializers/lottery-form-initializer.js

import { withPluginApi } from "discourse/lib/plugin-api";
import { A } from "@ember/array";
import { computed } from "@ember/object";

export default {
  name: "lottery-form-initializer",
  initialize() {
    withPluginApi(" lotteryData = this.get("model.lotteryFormData");
          if (lotteryData) {
            this.get("model").set("custom_fields.lottery", JSON.stringify(lotteryData));
          }
          1.0.0", (api) => {
      api.modifyClass("controller:composer", {
        pluginreturn this._super(options);
        },
      });
    });
    
