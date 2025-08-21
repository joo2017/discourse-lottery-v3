// file: discourse-lottery-v3/assets/javascripts/discourse/initializers/lottery-form-initializer.js

import { withPluginApi } from "discourse/lib/plugin-api";
import { A } from "@ember/array";
import { computed } from "@ember/object";

export default {
  name: "lottery-form-initializer",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",

        shouldShowLotteryForm: computed('model.categoryId', 'model.action', function () {
          const siteSettings = this.siteSettings;
          if (!siteSettings.lottery_enabled) {
            return false;
          }

          const allowedCategoriesSetting = siteSettings.lottery_allowed_categories || "";
          const allowedCategories = A(allowedCategoriesSetting.split('|').map(Number).filter(id => id > 0));
          const currentCategoryId = this.get('model.categoryId');

          return this.get('model.action') === 'createTopic' &&
                 !allowedCategories.isEmpty() &&
                 allowedCategories.includes(currentCategoryId);
        }),
        
        save(options) {
          const lotteryData = this.get("model.lotteryFormData");
          if (lotteryData) {
            this.get("model").set("custom_fields.lottery", JSON.stringify(lotteryData));
          }
          return this._super(options);
        },
      });
    });
  },
};
