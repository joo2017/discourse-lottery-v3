import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-form-initializer",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      // 修改 composer 控制器来保存抽奖数据
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",
        
        save(options) {
          console.log("🎲 Composer save called");
          console.log("🎲 Checking for lottery form...");
          
          // 检查全局抽奖表单引用
          if (window.currentLotteryForm) {
            console.log("🎲 Found lottery form via global reference");
            const formData = window.currentLotteryForm.formData;
            console.log("🎲 Lottery form data:", formData);
            
            // 将抽奖数据保存到 custom_fields
            if (!this.get("model.custom_fields")) {
              this.get("model").set("custom_fields", {});
            }
            this.get("model").set("custom_fields.lottery", JSON.stringify(formData));
            console.log("🎲 Saved lottery data to custom_fields");
            console.log("🎲 Model custom_fields:", this.get("model.custom_fields"));
          } else {
            console.log("🎲 No lottery form found");
          }
          
          return this._super(options);
        }
      });
    });
  },
};
