import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-form-initializer",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      // 修改 composer 控制器来保存抽奖数据
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",
        
        save(options) {
          console.log("Composer save called");
          console.log("Checking for lottery form...");
          
          // 优先从缓存获取数据（防止组件被重新创建导致数据丢失）
          if (window.lotteryFormDataCache) {
            console.log("Found cached lottery form data");
            const formData = window.lotteryFormDataCache;
            console.log("Cached lottery form data:", formData);
            
            // 验证缓存数据是否有效（非空）
            if (formData.prize_name && formData.prize_details && formData.draw_time) {
              console.log("Cache data is valid, using cached data");
              
              // 确保 custom_fields 对象存在
              const model = this.get("model");
              if (!model.custom_fields) {
                model.set("custom_fields", {});
              }
              
              // 直接设置到模型属性
              model.set("custom_fields.lottery", JSON.stringify(formData));
              
              // 标记模型为脏数据
              model.notifyPropertyChange("custom_fields");
              
              console.log("Saved lottery data to custom_fields");
              console.log("Final model custom_fields:", model.custom_fields);
              
              // 清理缓存
              window.lotteryFormDataCache = null;
            } else {
              console.log("Cache data is invalid (empty fields), not using cache");
            }
          }
          // 然后尝试从活跃组件获取数据（作为备选）
          else if (window.currentLotteryForm) {
            console.log("Found lottery form via global reference");
            const formData = window.currentLotteryForm.formData;
            console.log("Lottery form data:", formData);
            
            // 验证组件数据是否有效
            if (formData.prize_name && formData.prize_details && formData.draw_time) {
              console.log("Component data is valid, using component data");
              
              // 确保 custom_fields 对象存在
              const model = this.get("model");
              if (!model.custom_fields) {
                model.set("custom_fields", {});
              }
              
              // 直接设置到模型属性
              model.set("custom_fields.lottery", JSON.stringify(formData));
              
              // 标记模型为脏数据
              model.notifyPropertyChange("custom_fields");
              
              console.log("Saved lottery data to custom_fields");
            } else {
              console.log("Component data is invalid (empty fields), not saving");
            }
          } else {
            console.log("No lottery form found");
          }
          
          return this._super(options);
        }
      });
    });
  },
};
