use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;
use arcium_client::idl::arcium::types::CallbackAccount;

const COMP_DEF_OFFSET_FIND_MATCHES: u32 = comp_def_offset("find_matches");
const SET_SIZE: usize = 16;

declare_id!("FK6iXAx5Bd86x1ypL5Nq91D6HXFXXWTJ1CjSmguwA9i5");

#[arcium_program]
pub mod private_match_app {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let state = &mut ctx.accounts.program_state;
        state.authority = ctx.accounts.authority.key();
        state.total_matches = 0;
        state.total_users = 0;
        Ok(())
    }

    pub fn register_user(ctx: Context<RegisterUser>, username: String) -> Result<()> {
        let user = &mut ctx.accounts.user_account;
        user.owner = ctx.accounts.authority.key();
        user.username = username;
        user.contact_count = 0;
        user.match_requests = 0;
        user.bump = ctx.bumps.user_account;
        let state = &mut ctx.accounts.program_state;
        state.total_users += 1;
        Ok(())
    }

    pub fn init_find_matches_comp_def(ctx: Context<InitFindMatchesCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, None, None)?;
        Ok(())
    }

    pub fn find_matches(
        ctx: Context<FindMatches>,
        computation_offset: u64,
        ct_hashes_a: [[u8; 32]; SET_SIZE],
        ct_count_a: [u8; 32],
        pub_key_a: [u8; 32],
        nonce_a: u128,
        ct_hashes_b: [[u8; 32]; SET_SIZE],
        ct_count_b: [u8; 32],
        pub_key_b: [u8; 32],
        nonce_b: u128,
    ) -> Result<()> {
        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;
        let mut builder = ArgBuilder::new()
            .x25519_pubkey(pub_key_a)
            .plaintext_u128(nonce_a);
        for i in 0..SET_SIZE {
            builder = builder.encrypted_u128(ct_hashes_a[i]);
        }
        builder = builder.encrypted_u8(ct_count_a);
        builder = builder
            .x25519_pubkey(pub_key_b)
            .plaintext_u128(nonce_b);
        for i in 0..SET_SIZE {
            builder = builder.encrypted_u128(ct_hashes_b[i]);
        }
        builder = builder.encrypted_u8(ct_count_b);
        let args = builder.build();
        let match_record_pda = ctx.accounts.match_record.key();
        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            vec![FindMatchesCallback::callback_ix(
                computation_offset,
                &ctx.accounts.mxe_account,
                &[CallbackAccount {
                    pubkey: match_record_pda,
                    is_writable: true,
                }],
            )?],
            1,
            0,
        )?;
        Ok(())
    }

    #[arcium_callback(encrypted_ix = "find_matches")]
    pub fn find_matches_callback(
        ctx: Context<FindMatchesCallback>,
        output: SignedComputationOutputs<FindMatchesOutput>,
    ) -> Result<()> {
        let o = match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account,
        ) {
            Ok(FindMatchesOutput { field_0 }) => field_0,
            Err(_) => return Err(ErrorCode::AbortedComputation.into()),
        };
        let record = &mut ctx.accounts.match_record;
        record.completed = true;
        emit!(MatchCompleteEvent {
            user_a_result_nonce: o.field_0.nonce.to_le_bytes(),
            user_b_result_nonce: o.field_1.nonce.to_le_bytes(),
            user_a_flags: o.field_0.ciphertexts,
            user_b_flags: o.field_1.ciphertexts,
        });
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(init, payer = authority, space = 8 + ProgramState::INIT_SPACE, seeds = [b"program_state"], bump)]
    pub program_state: Account<'info, ProgramState>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(username: String)]
pub struct RegisterUser<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(init, payer = authority, space = 8 + UserAccount::INIT_SPACE, seeds = [b"user", authority.key().as_ref()], bump)]
    pub user_account: Account<'info, UserAccount>,
    #[account(mut, seeds = [b"program_state"], bump)]
    pub program_state: Account<'info, ProgramState>,
    pub system_program: Program<'info, System>,
}

#[init_computation_definition_accounts("find_matches", payer)]
#[derive(Accounts)]
pub struct InitFindMatchesCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    /// CHECK: comp_def_account, checked by arcium program.
    pub comp_def_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_mxe_lut_pda!(mxe_account.lut_offset_slot))]
    /// CHECK: address_lookup_table, checked by arcium program.
    pub address_lookup_table: UncheckedAccount<'info>,
    #[account(address = LUT_PROGRAM_ID)]
    /// CHECK: lut_program is the Address Lookup Table program.
    pub lut_program: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[queue_computation_accounts("find_matches", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct FindMatches<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(init_if_needed, space = 9, payer = payer, seeds = [&SIGN_PDA_SEED], bump, address = derive_sign_pda!())]
    pub sign_pda_account: Account<'info, ArciumSignerAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(mut, address = derive_mempool_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    /// CHECK: mempool_account, checked by the arcium program.
    pub mempool_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_execpool_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    /// CHECK: executing_pool, checked by the arcium program.
    pub executing_pool: UncheckedAccount<'info>,
    #[account(mut, address = derive_comp_pda!(computation_offset, mxe_account, ErrorCode::ClusterNotSet))]
    /// CHECK: computation_account, checked by the arcium program.
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_FIND_MATCHES))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(mut, address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    #[account(mut, address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,
    #[account(init, payer = payer, space = 8 + MatchRecord::INIT_SPACE, seeds = [b"match_record", computation_offset.to_le_bytes().as_ref()], bump)]
    pub match_record: Account<'info, MatchRecord>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

#[callback_accounts("find_matches")]
#[derive(Accounts)]
pub struct FindMatchesCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_FIND_MATCHES))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    /// CHECK: computation_account, checked by arcium program via constraints in the callback context.
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: instructions_sysvar, checked by the account constraint
    pub instructions_sysvar: AccountInfo<'info>,
    #[account(mut)]
    pub match_record: Account<'info, MatchRecord>,
}

#[account]
#[derive(InitSpace)]
pub struct ProgramState {
    pub authority: Pubkey,
    pub total_matches: u64,
    pub total_users: u64,
}

#[account]
#[derive(InitSpace)]
pub struct UserAccount {
    pub owner: Pubkey,
    #[max_len(32)]
    pub username: String,
    pub contact_count: u16,
    pub match_requests: u32,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct MatchRecord {
    pub user_a: Pubkey,
    pub user_b: Pubkey,
    pub completed: bool,
    pub timestamp: i64,
}

#[event]
pub struct MatchCompleteEvent {
    pub user_a_result_nonce: [u8; 16],
    pub user_b_result_nonce: [u8; 16],
    pub user_a_flags: [[u8; 32]; 17],
    pub user_b_flags: [[u8; 32]; 17],
}

#[error_code]
pub enum ErrorCode {
    #[msg("The computation was aborted")]
    AbortedComputation,
    #[msg("Cluster not set")]
    ClusterNotSet,
}
