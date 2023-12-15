$(function(){
    $('.skill-approve-btn').on('click', approveSkill);
    $('.skill-comment-save').on('click', saveSkillComment);
    $('.review-alert').hide();
});


async function approveSkill(e){
    e.preventDefault();
    const skillId = $(this).data('skillid');
    const csrfToken = $(this).data('csrfToken');
    const url = `/skill/${skillId}/review`;
    const request = await fetch(url, {
        method:'POST',
        headers: {
            'CSRF-Token': csrfToken,
            'Content-Type': 'application/json'
        },
        body:JSON.stringify({
            approved:true
        })
    });
    const result = await request.json();
    if (result.success){
        $(this).closest('.review-skill').hide();
        $('.review-alert').show();
    } else {
        console.log(result.error);
    }
}


async function saveSkillComment(e){
    e.preventDefault();
    e.stopPropagation();
    const $this = $(this);
    $this.attr('disabled', true);
    const skillId = $this.data('skillid');
    const csrfToken = $this.data('csrfToken');
    const content = $this.closest('.review-skill').find('.skill-comment').val();
    const url = `/skill/${skillId}/review`;
    const request = await fetch(url, {
        method:'POST',
        headers: {
            'CSRF-Token': csrfToken,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            content:content
        })
    });
    const result = await request.json();
    if (result.success){
        const $comments = $(this).closest('.review-skill').find('.skill-comments');
        const $comment = $('<li>')
            .addClass('media').addClass('d-flex').addClass('align-items-left').addClass('border-bottom').addClass('border-light')
            .append($('<div>')
                .addClass('media-body')
                .append($('<strong>')
                    .addClass('mt-0')
                    .text('Me'))
                .append($('<p>').addClass('my-1').text(content))
            );
        $comments.append($comment);
        $this.closest('.skill-comment-form').collapse('hide');
        $this.closest('.review-skill').find('.skill-comment').val('');
        $this.attr('disabled', false);
        $('.review-alert').show();

    } else {
        $this.attr('disabled', false);
        console.log(result.error);
    }
}
