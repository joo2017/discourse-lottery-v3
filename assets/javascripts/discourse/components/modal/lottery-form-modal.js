import Component from "@ember/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";

export default class LotteryFormModal extends Component {
  // 表单数据（使用 @tracked）
  @tracked prizeName = "";
  @tracked prizeDetails = "";
  @tracked drawTime = "";
  @tracked winnersCount = 1;
  @tracked specifiedPosts = "";
  @tracked minParticipants = 5;
  @tracked backupStrategy = "continue";
  @tracked additionalNotes = "";

  // 模态框状态
  @tracked flash = "";
  @tracked flashType = "";
  @tracked isLoading = false;

  constructor() {
    super(...arguments);
    console.log("🎲 抽奖表单模态框组件初始化");
    
    // 初始化最小参与人数
    this.minParticipants = this.args.model?.siteSettings?.lottery_min_participants_global || 5;
    
    // 设置默认开奖时间（1小时后）
    const defaultTime = new Date();
    defaultTime.setHours(defaultTime.getHours() + 1);
    this.drawTime = defaultTime.toISOString().slice(0, 16);
  }

  // 表单验证
  get isValid() {
    const hasRequired = this.prizeName.trim() && 
                       this.prizeDetails.trim() && 
                       this.drawTime.trim();
    const validMinParticipants = this.minParticipants >= this.globalMinParticipants;
    return hasRequired && validMinParticipants;
  }

  // 全局最小参与人数
  get globalMinParticipants() {
    return this.args.model?.siteSettings?.lottery_min_participants_global || 5;
  }

  // 显示 flash 消息
  @action
  showFlash(message, type = "error") {
    this.flash = message;
    this.flashType = type;
  }

  // 清除 flash 消息
  @action
  clearFlash() {
    this.flash = "";
    this.flashType = "";
  }

  // 关闭模态框的包装器
  @action
  closeModalWrapper(data = null) {
    console.log("🎲 关闭抽奖表单模态框");
    this.args.closeModal(data);
  }

  // 提交表单
  @action
  async submit() {
    console.log("🎲 提交抽奖表单");
    this.clearFlash();

    if (!this.isValid) {
      this.showFlash("请填写所有必填字段");
      return;
    }

    // 验证时间
    const drawDate = new Date(this.drawTime);
    if (isNaN(drawDate.getTime()) || drawDate <= new Date()) {
      this.showFlash("开奖时间必须是未来时间");
      return;
    }

    // 验证参与门槛
    if (this.minParticipants < this.globalMinParticipants) {
      this.showFlash(`参与门槛不能低于全局设置的 ${this.globalMinParticipants} 人`);
      return;
    }

    this.isLoading = true;

    try {
      // 构建抽奖数据
      const lotteryData = {
        prize_name: this.prizeName.trim(),
        prize_details: this.prizeDetails.trim(),
        draw_time: this.drawTime.trim(),
        winners_count: this.winnersCount,
        specified_posts: this.specifiedPosts.trim(),
        min_participants: this.minParticipants,
        backup_strategy: this.backupStrategy,
        additional_notes: this.additionalNotes.trim()
      };

      console.log("🎲 抽奖数据:", lotteryData);

      // 缓存数据供后续使用
      window.lotteryFormDataCache = lotteryData;

      // 获取编辑器并插入内容
      const composer = this.args.model?.composer;
      if (composer) {
        const placeholder = `\n\n[lottery]\n活动名称：${lotteryData.prize_name}\n奖品说明：${lotteryData.prize_details}\n开奖时间：${lotteryData.draw_time}\n[/lottery]\n\n`;
        const currentText = composer.get("model.reply") || "";
        composer.set("model.reply", currentText + placeholder);

        console.log("🎲 抽奖内容插入成功");
        
        // 显示成功消息并关闭
        this.showFlash("抽奖信息已插入编辑器", "success");
        setTimeout(() => {
          this.closeModalWrapper({ success: true });
        }, 1000);
      } else {
        this.showFlash("无法获取编辑器");
      }
    } catch (error) {
      console.error("🎲 插入抽奖内容失败:", error);
      this.showFlash("插入失败：" + error.message);
    } finally {
      this.isLoading = false;
    }
  }

  // 取消操作
  @action
  cancel() {
    console.log("🎲 取消抽奖表单");
    this.closeModalWrapper({ cancelled: true });
  }
}
