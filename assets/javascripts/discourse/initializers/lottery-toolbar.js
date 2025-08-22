import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-toolbar",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      // 检查分类是否允许抽奖的辅助函数
      function canInsertLottery(composer) {
        const allowedCategories = composer.siteSettings?.lottery_allowed_categories;
        if (!allowedCategories) return false;
        
        const allowedIds = allowedCategories
          .split("|")
          .map(id => Number(id.trim()))
          .filter(id => !isNaN(id) && id > 0);
        
        const currentCategoryId = Number(composer.get("model.categoryId") || 0);
        
        console.log("🎲 Lottery toolbar check:");
        console.log("  Allowed categories:", allowedIds);
        console.log("  Current category:", currentCategoryId);
        console.log("  Can show:", allowedIds.includes(currentCategoryId));
        
        return allowedIds.includes(currentCategoryId);
      }

      // 添加编辑器工具栏按钮
      api.addToolbarPopupMenuOptionsCallback((composer) => {
        console.log("🎲 Toolbar popup menu callback called");
        
        if (canInsertLottery(composer)) {
          console.log("🎲 Adding lottery option to menu");
          return {
            action: "lotteryInsert",  // 改为驼峰命名
            icon: "dice",
            label: "插入抽奖",
            className: "lottery-toolbar-button"
          };
        } else {
          console.log("🎲 Not adding lottery option - category not allowed");
          return null;
        }
      });

      // 修改 composer 控制器 - 使用正确的方法注册 action
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",
        
        // 直接定义 action 方法
        lotteryInsert() {
          console.log("🎲 Lottery insert action called");
          this.openLotteryDialog();
        },

        openLotteryDialog() {
          console.log("🎲 Opening lottery dialog");
          
          // 检查 modal 服务是否存在
          if (this.modal) {
            this.modal.show("lottery-settings", {
              model: {
                composer: this
              }
            });
          } else {
            console.error("🎲 Modal service not found");
            
            // 临时替代方案：用 alert 显示表单
            const formData = this.collectLotteryData();
            if (formData) {
              // 插入到编辑器
              const placeholder = `\n\n[lottery]\n活动名称：${formData.prizeName}\n[/lottery]\n\n`;
              const currentText = this.get("model.reply") || "";
              this.set("model.reply", currentText + placeholder);
              
              // 保存数据
              window.lotteryFormDataCache = formData;
            }
          }
        },

        // 临时收集数据的方法
        collectLotteryData() {
          const prizeName = prompt("请输入活动名称：");
          if (!prizeName) return null;
          
          const prizeDetails = prompt("请输入奖品说明：");
          if (!prizeDetails) return null;
          
          const drawTime = prompt("请输入开奖时间 (格式: 2025-08-24T20:00)：");
          if (!drawTime) return null;
          
          return {
            prize_name: prizeName,
            prize_details: prizeDetails,
            draw_time: drawTime,
            winners_count: 1,
            specified_posts: "",
            min_participants: 10,
            backup_strategy: "continue",
            additional_notes: ""
          };
        }
      });

      console.log("🎲 Lottery toolbar initialized successfully");
    });
  },
};
