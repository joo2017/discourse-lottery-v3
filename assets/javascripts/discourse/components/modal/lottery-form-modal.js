// 提交表单
@action
async submit() {
  console.log("🎲 开始提交抽奖表单");
  this.clearFlash();

  if (!this.isValid) {
    this.showFlash("请填写所有必填字段");
    return;
  }

  // 验证时间格式和有效性
  try {
    const drawDate = new Date(this.drawTime);
    if (isNaN(drawDate.getTime())) {
      this.showFlash("开奖时间格式无效");
      return;
    }
    if (drawDate <= new Date()) {
      this.showFlash("开奖时间必须是未来时间");
      return;
    }
  } catch (e) {
    this.showFlash("开奖时间格式无效");
    return;
  }

  // 验证参与门槛
  if (this.minParticipants < this.globalMinParticipants) {
    this.showFlash(`参与门槛不能低于全局设置的 ${this.globalMinParticipants} 人`);
    return;
  }

  this.isLoading = true;
  console.log("🎲 开始处理表单提交，设置加载状态");

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
      additional_notes: this.additionalNotes.trim(),
      prize_image: this.prizeImage.trim()
    };

    console.log("🎲 构建的抽奖数据对象:", lotteryData);

    // 官方推荐方式：直接设置到 composer.customFields
    const composer = this.args.model?.composer;
    console.log("🎲 获取编辑器实例:", composer);
    
    if (composer) {
      // 设置自定义字段（官方推荐方式）
      if (!composer.customFields) {
        composer.customFields = {};
      }
      composer.customFields.lottery = lotteryData;
      console.log("🎲 ✅ 设置 composer.customFields.lottery:", lotteryData);

      // 同时插入 BBCode 到编辑器显示
      let placeholder = `\n[lottery]\n`;
      placeholder += `活动名称：${lotteryData.prize_name}\n`;
      placeholder += `奖品说明：${lotteryData.prize_details}\n`;
      placeholder += `开奖时间：${lotteryData.draw_time}\n`;
      
      // 智能判断抽奖方式
      if (lotteryData.specified_posts && lotteryData.specified_posts.trim()) {
        placeholder += `抽奖方式：指定楼层\n`;
        placeholder += `指定楼层：${lotteryData.specified_posts}\n`;
      } else {
        placeholder += `抽奖方式：随机抽取\n`;
        placeholder += `获奖人数：${lotteryData.winners_count}\n`;
      }
      
      placeholder += `参与门槛：${lotteryData.min_participants}人\n`;
      
      // 补充说明（如果有）
      if (lotteryData.additional_notes && lotteryData.additional_notes.trim()) {
        placeholder += `补充说明：${lotteryData.additional_notes}\n`;
      }
      
      // 奖品图片（如果有）
      if (lotteryData.prize_image && lotteryData.prize_image.trim()) {
        placeholder += `奖品图片：${lotteryData.prize_image}\n`;
      }
      
      placeholder += `[/lottery]\n\n`;

      const currentText = composer.get("model.reply") || "";
      composer.set("model.reply", currentText + placeholder);

      console.log("🎲 抽奖内容成功插入到编辑器");
      console.log("🎲 插入的完整占位符:", placeholder);
      
      // 显示成功消息
      this.showFlash("抽奖信息已插入编辑器", "success");
      
      // 延迟关闭模态框，让用户看到成功提示
      setTimeout(() => {
        console.log("🎲 关闭模态框");
        this.args.closeModal();
      }, 1500);
    } else {
      console.error("🎲 无法获取编辑器实例");
      this.showFlash("无法获取编辑器，请刷新页面重试");
    }
  } catch (error) {
    console.error("🎲 提交表单时发生错误:", error);
    this.showFlash("提交失败：" + error.message);
  } finally {
    this.isLoading = false;
    console.log("🎲 清除加载状态");
  }
}
