import { withPluginApi } from "discourse/lib/plugin-api";
import { service } from "@ember/service";

export default {
  name: "lottery-toolbar",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      console.log("🎲 Official API lottery toolbar initializer starting...");
      
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

      // 使用 Composer 控制器来处理模态框
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",

        actions: {
          openLotteryModal() {
            console.log("🎲 Opening official API lottery modal");
            
            if (!canInsertLottery()) {
              alert("当前分类不支持抽奖功能，请在管理后台设置的允许分类中创建主题");
              return;
            }

            // 动态导入模态框组件
            import("../../components/modal/lottery-modal").then((module) => {
              const LotteryModal = module.default;
              
              // 使用官方推荐的 modal service
              this.modal.show(LotteryModal, {
                model: {
                  onSubmit: handleLotterySubmit
                }
              }).then((result) => {
                // 模态框关闭时的回调
                if (result && result.prize_name) {
                  console.log("🎲 Modal closed with result:", result);
                }
              }).catch((error) => {
                console.log("🎲 Modal closed without result or with error:", error);
              });
              
            }).catch((error) => {
              console.error("🎲 Failed to load lottery modal component:", error);
              // 降级到简单提示框
              this.send("fallbackLotteryForm");
            });
          },

          fallbackLotteryForm() {
            console.log("🎲 Using fallback lottery form");
            
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
            
            const lotteryData = {
              prize_name: prizeName,
              prize_details: prizeDetails,
              draw_time: drawTime,
              winners_count: 1,
              specified_posts: "",
              min_participants: this.siteSettings?.lottery_min_participants_global || 5,
              backup_strategy: "continue",
              additional_notes: ""
            };
            
            handleLotterySubmit(lotteryData);
          }
        }
      });

      // 使用工具栏按钮
      api.onToolbarCreate((toolbar) => {
        console.log("🎲 Toolbar created, adding official API lottery button");
        
        toolbar.addButton({
          id: "lottery-insert",
          group: "extras",
          icon: "dice",
          title: "创建抽奖活动",
          className: "lottery-toolbar-btn",
          shortcut: "Ctrl+L",
          perform: () => {
            console.log("🎲 Official API lottery button clicked");
            
            // 直接获取 composer 控制器并调用方法
            const composer = api.container.lookup("controller:composer");
            if (composer && composer.send) {
              composer.send("openLotteryModal");
            } else {
              // 直接调用打开模态框的逻辑
              openLotteryModal();
            }
          },
          condition: () => {
            return canInsertLottery();
          }
        });
        
        console.log("🎲 Official API lottery button added to toolbar");
      });

      // 直接定义打开模态框的函数
      function openLotteryModal() {
        console.log("🎲 Opening official API lottery modal directly");
        
        if (!canInsertLottery()) {
          alert("当前分类不支持抽奖功能，请在管理后台设置的允许分类中创建主题");
          return;
        }

        // 获取 modal service
        const modal = api.container.lookup("service:modal");
        if (!modal) {
          console.error("🎲 Modal service not found, using fallback");
          fallbackLotteryForm();
          return;
        }

        // 动态导入模态框组件
        import("../../components/modal/lottery-modal").then((module) => {
          const LotteryModal = module.default;
          
          console.log("🎲 Successfully imported lottery modal component");
          
          // 使用官方推荐的 modal service
          modal.show(LotteryModal, {
            model: {
              onSubmit: handleLotterySubmit
            }
          }).then((result) => {
            // 模态框关闭时的回调
            if (result && result.prize_name) {
              console.log("🎲 Modal closed with result:", result);
            }
          }).catch((error) => {
            console.log("🎲 Modal closed without result or with error:", error);
          });
          
        }).catch((error) => {
          console.error("🎲 Failed to load lottery modal component:", error);
          // 降级到简单提示框
          fallbackLotteryForm();
        });
      }

      // 降级方案函数
      function fallbackLotteryForm() {
        console.log("🎲 Using fallback lottery form");
        
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

      console.log("🎲 Official API lottery toolbar initializer completed");
    });
  },
};
