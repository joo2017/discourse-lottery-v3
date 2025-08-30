// assets/javascripts/discourse/initializers/lottery-composer-integration.js
import { withPluginApi } from "discourse/lib/plugin-api";
import LotteryFormModal from "../components/modal/lottery-form-modal";

export default {
  name: "lottery-composer-integration",
  initialize() {
    withPluginApi("1.4.0", (api) => {
      console.log("Lottery: Initializing composer integration");

      // 官方推荐：注册自定义字段序列化
      api.serializeOnCreate('lottery');
      api.serializeToDraft('lottery');
      api.serializeToTopic('lottery', 'topic.lottery');

      // 检查分类权限
      function canInsertLottery() {
        const composer = api.container.lookup("controller:composer");
        if (!composer) return false;

        const siteSettings = api.container.lookup("service:site-settings");
        const allowedCategories = siteSettings?.lottery_allowed_categories;
        
        if (!allowedCategories) return true;

        const allowedIds = allowedCategories
          .split("|")
          .map(id => Number(id.trim()))
          .filter(id => !isNaN(id) && id > 0);

        const currentCategoryId = Number(composer.get("model.categoryId") || 0);
        return allowedIds.includes(currentCategoryId);
      }

      // 添加工具栏按钮
      api.onToolbarCreate((toolbar) => {
        toolbar.addButton({
          title: "插入抽奖",
          id: "insertLottery", 
          group: "extras",
          icon: "dice",
          shortcut: "Ctrl+Shift+L",
          perform: (e) => {
            const siteSettings = api.container.lookup("service:site-settings");
            
            if (!siteSettings?.lottery_enabled) {
              alert("抽奖功能已被管理员关闭");
              return;
            }

            if (!canInsertLottery()) {
              alert("当前分类不支持抽奖功能");
              return;
            }

            const modal = api.container.lookup("service:modal");
            const composer = api.container.lookup("controller:composer");
            
            modal.show(LotteryFormModal, {
              model: { 
                toolbarEvent: e,
                composer: composer,
                siteSettings: siteSettings
              }
            });
          }
        });
      });

      // 官方推荐：使用 modifyClass 进行安全的方法扩展
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",
        
        save(options = {}) {
          const model = this.get("model");
          
          // 检查是否有抽奖数据需要传递
          if (model.custom_fields && model.custom_fields.lottery) {
            console.log("Lottery: Found lottery data in custom_fields, ensuring it's passed to backend");
            
            // 确保 lottery 数据会被传递到后端的 opts 参数中
            if (!options) options = {};
            options.lottery = model.custom_fields.lottery;
            
            // 同时确保模型属性被正确设置
            model.set("lottery", model.custom_fields.lottery);
            model.notifyPropertyChange("lottery");
          }
          
          return this._super(options);
        }
      });

      // 官方推荐：使用 modifyClass 扩展 composer 模型序列化
      api.modifyClass("model:composer", {
        pluginId: "discourse-lottery-v3",
        
        serialize(serializer, dest) {
          const result = this._super(serializer, dest);
          
          // 确保 lottery 数据被包含在序列化结果中
          if (this.custom_fields && this.custom_fields.lottery) {
            result.lottery = this.custom_fields.lottery;
          }
          
          return result;
        }
      });

      console.log("Lottery: Composer integration initialized successfully");
    });
  },
};
