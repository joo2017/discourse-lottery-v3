import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-form-initializer",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      console.log("🎲 Lottery form initializer loaded");
      
      // 关键修复：在 composer 创建时就设置钩子
      api.modifyClass("model:composer", {
        pluginId: "discourse-lottery-v3",
        
        // 重写 save 方法，在保存前注入数据
        save(opts) {
          console.log("🎲 Composer model save called");
          console.log("🎲 Current custom_fields:", this.custom_fields);
          
          // 检查缓存数据
          if (window.lotteryFormDataCache) {
            console.log("🎲 Found lottery cache data");
            const formData = window.lotteryFormDataCache;
            
            if (formData.prize_name && formData.prize_details && formData.draw_time) {
              console.log("🎲 Valid data, injecting into custom_fields");
              
              // 确保 custom_fields 存在
              if (!this.custom_fields) {
                this.custom_fields = {};
              }
              
              // 直接设置数据
              this.custom_fields.lottery = JSON.stringify(formData);
              
              console.log("🎲 Injected lottery data:", this.custom_fields.lottery);
              console.log("🎲 Final custom_fields:", this.custom_fields);
              
              // 清理缓存
              window.lotteryFormDataCache = null;
              console.log("🎲 Cache cleared");
            }
          }
          
          // 调用原始 save 方法
          return this._super(opts);
        }
      });
      
      // 备用方法：通过控制器也设置一遍
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",
        
        save(options) {
          console.log("🎲 Controller save called");
          
          if (window.lotteryFormDataCache) {
            const formData = window.lotteryFormDataCache;
            
            if (formData.prize_name && formData.prize_details && formData.draw_time) {
              const model = this.get("model");
              
              if (!model.custom_fields) {
                model.custom_fields = {};
              }
              
              model.custom_fields.lottery = JSON.stringify(formData);
              
              console.log("🎲 Backup: Set data via controller");
            }
          }
          
          return this._super(options);
        }
      });
    });
  },
};
