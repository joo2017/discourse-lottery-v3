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
          
          // 优先从缓存获取数据（防止组件被重新创建导致数据丢失）
          if (window.lotteryFormDataCache) {
            console.log("🎲 Found cached lottery form data");
            const formData = window.lotteryFormDataCache;
            console.log("🎲 Cached lottery form data:", formData);
            
            // 验证缓存数据是否有效（非空）
            if (formData.prize_name && formData.prize_details && formData.draw_time) {
              console.log("🎲 Cache data is valid, using cached data");
              
              // 确保 custom_fields 对象存在
              if (!this.get("model.custom_fields")) {
                this.get("model").set("custom_fields", {});
              }
              
              // 设置抽奖数据
              this.get("model").set("custom_fields.lottery", JSON.stringify(formData));
              
              // 强制标记为脏数据，确保保存
              this.get("model").notifyPropertyChange("custom_fields");
              
              console.log("🎲 Saved cached lottery data to custom_fields");
              console.log("🎲 Final custom_fields:", this.get("model.custom_fields"));
              
              // 清理缓存
              window.lotteryFormDataCache = null;
            } else {
              console.log("🎲 Cache data is invalid (empty fields), not using cache");
            }
          }
          // 然后尝试从活跃组件获取数据（作为备选）
          else if (window.currentLotteryForm) {
            console.log("🎲 Found lottery form via global reference");
            const formData = window.currentLotteryForm.formData;
            console.log("🎲 Lottery form data:", formData);
            
            // 验证组件数据是否有效
            if (formData.prize_name && formData.prize_details && formData.draw_time) {
              console.log("🎲 Component data is valid, using component data");
              
              // 将抽奖数据保存到 custom_fields
              if (!this.get("model.custom_fields")) {
                this.get("model").set("custom_fields", {});
              }
              this.get("model").set("custom_fields.lottery", JSON.stringify(formData));
              console.log("🎲 Saved lottery data to custom_fields");
            } else {
              console.log("🎲 Component data is invalid (empty fields), not saving");
            }
          } else {
            console.log("🎲 No lottery form found");
          }
          
          console.log("🎲 Model custom_fields:", this.get("model.custom_fields"));
          return this._super(options);
        }
      });
    });
  },
};
