import Controller from "@ember/controller";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";

export default class LotteryFormController extends Controller {
  // 表单数据
  @tracked prizeName = "";
  @tracked prizeDetails = "";
  @tracked drawTime = "";
  @tracked winnersCount = 1;
  @tracked specifiedPosts = "";
  @tracked minParticipants = 5;
  @tracked backupStrategy = "continue";
  @tracked additionalNotes = "";

  // 状态
  @tracked isLoading = false;
  @tracked flashMessage = "";
  @tracked flashType = "";

  // 初始化（替代 onShow）
  init() {
    super.init(...arguments);
    console.log("🎲 抽奖表单控制器初始化");
  }

  // 模态框显示时调用
  onShow() {
    console.log("🎲 抽奖表单模态框显示");
    this.resetForm();
  }

  // 重置表单
  resetForm() {
    this.prizeName = "";
    this.prizeDetails = "";
    this.drawTime = "";
    this.winnersCount = 1;
    this.specifiedPosts = "";
    this.minParticipants = this.globalMinParticipants;
    this.backupStrategy = "continue";
    this.additionalNotes = "";
    this.isLoading = false;
    this.clearFlash();

    // 设置默认开奖时间（1小时后）
    const defaultTime = new Date();
    defaultTime.setHours(defaultTime.getHours() + 1);
    this.drawTime = defaultTime.toISOString().slice(0, 16);
  }

  // 获取全局最小参与人数
  get globalMinParticipants() {
    return this.model?.siteSettings?.lottery_min_participants_global || 5;
  }

  // 表单验证
  get isValid() {
    const hasRequired = this.prizeName.trim() && 
                       this.prizeDetails.trim() && 
                       this.drawTime.trim();
    const validMinParticipants = this.minParticipants >= this.globalMinParticipants;
    return hasRequired && validMinParticipants;
  }

  // 显示 flash 消息
  flash(message, type = "error") {
    this.flashMessage = message;
    this.flashType = type;
  }

  // 清除 flash 消息
  clearFlash() {
    this.flashMessage = "";
    this.flashType = "";
  }

  // 提交表单
  @action
  async submit() {
    console.log("🎲 提交抽奖表单");
    this.clearFlash();

    if (!this.isValid) {
      this.flash("请填写所有必填字段");
      return;
    }

    // 验证时间
    const drawDate = new Date(this.drawTime);
    if (isNaN(drawDate.getTime()) || drawDate <= new Date()) {
      this.flash("开奖时间必须是未来时间");
      return;
    }

    // 验证参与门槛
    if (this.minParticipants < this.globalMinParticipants) {
      this.flash(`参与门槛不能低于全局设置的 ${this.globalMinParticipants} 人`);
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

      // 调用传入的回调函数
      if (this.model?.insertLotteryContent) {
        this.model.insertLotteryContent(lotteryData);
      }

      // 显示成功消息并关闭
      this.flash("抽奖信息已插入编辑器", "success");
      setTimeout(() => {
        this.send("closeModal");
      }, 1000);

    } catch (error) {
      console.error("🎲 插入抽奖内容失败:", error);
      this.flash("插入失败：" + error.message);
    } finally {
      this.isLoading = false;
    }
  }

  // 取消操作
  @action
  cancel() {
    console.log("🎲 取消抽奖表单");
    this.send("closeModal");
  }
}
