use arcis::*;

#[encrypted]
mod circuits {
    use arcis::*;

    const SET_SIZE: usize = 16;

    pub struct ContactSet {
        hashes: [u128; SET_SIZE],
        count: u8,
    }

    pub struct MatchFlags {
        flags: [bool; SET_SIZE],
        match_count: u8,
    }

    #[instruction]
    pub fn find_matches(
        set_a: Enc<Shared, ContactSet>,
        set_b: Enc<Shared, ContactSet>,
    ) -> (Enc<Shared, MatchFlags>, Enc<Shared, MatchFlags>) {
        let a = set_a.to_arcis();
        let b = set_b.to_arcis();

        let mut flags_a = [false; SET_SIZE];
        let mut flags_b = [false; SET_SIZE];
        let mut count: u8 = 0;

        for i in 0..SET_SIZE {
            for j in 0..SET_SIZE {
                let both_valid = (i as u8) < a.count && (j as u8) < b.count;
                let hashes_match = a.hashes[i] == b.hashes[j];
                let non_zero = a.hashes[i] != 0;
                let is_match = both_valid && hashes_match && non_zero;
                if is_match {
                    flags_a[i] = true;
                    flags_b[j] = true;
                }
            }
        }

        for i in 0..SET_SIZE {
            if flags_a[i] {
                count += 1;
            }
        }

        let result_a = MatchFlags {
            flags: flags_a,
            match_count: count,
        };
        let result_b = MatchFlags {
            flags: flags_b,
            match_count: count,
        };

        (
            set_a.owner.from_arcis(result_a),
            set_b.owner.from_arcis(result_b),
        )
    }
}
