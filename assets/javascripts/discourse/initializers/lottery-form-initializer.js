import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-form-initializer",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      console.log("🎲 Lottery form initializer loaded");
      
      // 修改 composer 控制器来保存抽奖数据
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",
        
        save(options) {
          console.log("🎲 Composer save called");
          console.log("🎲 Checking for lottery form data...");
          
          // 优先从缓存获取数据
          if (window.lotteryFormDataCache) {
            console.log("🎲 Found cached lottery form data");
            const formData = window.lotteryFormDataCache;
            console.log("🎲 Cached lottery form data:", formData);
            
            // 验证缓存数据是否有效
            if (formData.prize_name && formData.prize_details && formData.draw_time) {
              console.log("🎲 Cache data is valid, using cached data");
              
              // 确保 custom_fields 对象存在
              const model = this.get("model");
              if (!model.custom_fields) {
                model.set("custom_fields", {});
              }
              
              // 关键修复：确保数据被正确序列化和标记为脏数据
              const serializedData = JSON.stringify(formData);
              model.set("custom_fields.lottery", serializedData);
              
              // 强制标记 custom_fields 为脏数据
              model.notifyPropertyChange("custom_fields");
              
              // 额外确保：也设置到 metaData（如果存在）
              if (!model.metaData) {
                model.set("metaData", {});
              }
              model.set("metaData.lottery", serializedData);
              
              console.log("🎲 Lottery data saved to model");
              console.log("🎲 Final custom_fields:", model.custom_fields);
              console.log("🎲 Serialized data:", serializedData);
              
              // 清理缓存
              window.lotteryFormDataCache = null;
            } else {
              console.log("🎲 Cache data is invalid (missing required fields), skipping");
            }
          } else {
            console.log("🎲 No lottery form cache found");
          }
          
          // 调用原始的 save 方法
          return this._super(options);
        }
      });
      
      // 添加调试：监听模型变化
      api.modifyClass("model:composer", {
        pluginId: "discourse-lottery-v3",
        
        init() {
          this._super(...arguments);
          console.log("🎲 Composer model initialized");
        }
      });
    });
  },
};
