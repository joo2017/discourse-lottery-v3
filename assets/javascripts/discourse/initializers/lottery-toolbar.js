import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-toolbar",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      console.log("🎲 New API lottery toolbar initializer starting...");
      
      // 检查分类是否允许抽奖的辅助函数
      function canInsertLottery() {
        const composer = api.container.lookup("controller:composer");
        if (!composer) {
          console.log("🎲 No composer found");
          return false;
        }
        
        const allowedCategories = composer.siteSettings?.lottery_allowed_categories;
        console.log("🎲 Allowed categories setting:", allowedCategories);
        
        if (!allowedCategories) {
          console.log("🎲 No allowed categories configured");
          return false;
        }
        
        const allowedIds = allowedCategories
          .split("|")
          .map(id => Number(id.trim()))
          .filter(id => !isNaN(id) && id > 0);
        
        const currentCategoryId = Number(composer.get("model.categoryId") || 0);
        
        console.log("🎲 Allowed category IDs:", allowedIds);
        console.log("🎲 Current category ID:", currentCategoryId);
        console.log("🎲 Can insert lottery:", allowedIds.includes(currentCategoryId));
        
        return allowedIds.includes(currentCategoryId);
      }

      // 处理模态框提交的函数
      function handleLotterySubmit(lotteryData) {
        console.log("🎲 Lottery data submitted:", lotteryData);
        
        const composer = api.container.lookup("controller:composer");
        if (!composer) {
          console.error("🎲 No composer found in handleLotterySubmit");
          return;
        }

        // 缓存数据供后续使用
        window.lotteryFormDataCache = lotteryData;
        
        // 在编辑器中插入占位符文本
        const placeholder = `\n\n[lottery]\n活动名称：${lotteryData.prize_name}\n奖品说明：${lotteryData.prize_details}\n开奖时间：${lotteryData.draw_time}\n[/lottery]\n\n`;
        
        // 直接修改 composer 内容
        const currentText = composer.get("model.reply") || "";
        composer.set("model.reply", currentText + placeholder);
        
        console.log("🎲 Inserted lottery placeholder into composer");
      }

      // 打开模态框的函数
      function openLotteryModal() {
        console.log("🎲 Opening new API lottery modal");
        
        if (!canInsertLottery()) {
          alert("当前分类不支持抽奖功能，请在管理后台设置的允许分类中创建主题");
          return;
        }

        // 使用新的 modal service API，但不导入组件类
        try {
          const modal = api.container.lookup("service:modal");
          if (modal) {
            console.log("🎲 Using modal service with component name");
            
            // 使用组件名称字符串而不是导入的类
            modal.show("lottery-modal", {
              model: {
                onSubmit: handleLotterySubmit
              }
            });
            
            console.log("🎲 Modal opened with component name");
            return;
          }
        } catch (e) {
          console.log("🎲 Modal service failed:", e.message);
        }

        console.error("🎲 Modal service not available, using fallback");
        // 降级到简单提示框
        fallbackToPrompts();
      }

      // 降级方案：如果模态框不可用，使用提示框
      function fallbackToPrompts() {
        console.log("🎲 Using fallback prompts");
        
        const prizeName = prompt("请输入活动名称：");
        if (!prizeName) return;
        
        const prizeDetails = prompt("请输入奖品说明：");
        if (!prizeDetails) return;
        
        const drawTime = prompt("请输入开奖时间 (格式: 2025-08-24T20:00)：");
        if (!drawTime) return;
        
        // 验证时间格式
        try {
          const testDate = new Date(drawTime);
          if (isNaN(testDate.getTime()) || testDate <= new Date()) {
            alert("时间格式无效或时间不能是过去时间");
            return;
          }
        } catch (e) {
          alert("时间格式无效");
          return;
        }
        
        const composer = api.container.lookup("controller:composer");
        const lotteryData = {
          prize_name: prizeName,
          prize_details: prizeDetails,
          draw_time: drawTime,
          winners_count: 1,
          specified_posts: "",
          min_participants: composer?.siteSettings?.lottery_min_participants_global || 5,
          backup_strategy: "continue",
          additional_notes: ""
        };
        
        handleLotterySubmit(lotteryData);
      }

      // 使用工具栏按钮 - 直接添加到工具栏，不使用弹出菜单
      api.onToolbarCreate((toolbar) => {
        console.log("🎲 Toolbar created, adding independent lottery button");
        
        toolbar.addButton({
          id: "lottery-insert",
          group: "extras", // 添加到额外工具组
          icon: "dice",
          title: "创建抽奖活动",
          className: "lottery-toolbar-btn",
          shortcut: "Ctrl+L",
          perform: () => {
            console.log("🎲 Independent lottery button clicked");
            openLotteryModal();
          },
          condition: () => {
            // 只在允许的分类中显示按钮
            return canInsertLottery();
          }
        });
        
        console.log("🎲 Independent lottery button added to toolbar");
      });

      console.log("🎲 New API lottery toolbar initializer completed");
    });
  },
};
