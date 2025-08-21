// file: discourse-lottery-v3/assets/javascripts/discourse/initializers/lottery-form-initializer.js

import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-form-initializer",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",
        
        // 渲染逻辑被完全移除，只留下数据保存的钩子
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
